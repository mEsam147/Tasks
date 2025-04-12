import puppeteer from "puppeteer-extra";
import { Page } from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Apply StealthPlugin to bypass LinkedIn's anti-bot measures
puppeteer.use(StealthPlugin());

interface LinkedInProfileData {
  name: string;
  photoUrl: string;
  profileUrl: string;
}

export async function scrapeLinkedInProfile(
  url: string
): Promise<LinkedInProfileData | null> {
  const browser = await puppeteer.launch({
    headless: false, // Keep false for debugging and manual CAPTCHA solving
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    // Set user agent and headers to mimic a real browser
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });

    // Load and validate cookies
    let cookies = await loadCookies();
    if (cookies) {
      // Check if cookies contain valid session
      const hasSessionCookie = cookies.some(
        (cookie) =>
          cookie.name === "li_at" && cookie.expires > Date.now() / 1000
      );
      if (hasSessionCookie) {
        await page.setCookie(...cookies);
        console.log("Cookies loaded.");
      } else {
        console.log("Cookies invalid or expired, forcing fresh login...");
        cookies = null;
      }
    }

    // Navigate to login page with retries
    console.log("Opening LinkedIn login page...");

    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto("https://www.linkedin.com/login", {
          waitUntil: "domcontentloaded", // Faster than networkidle2
          timeout: 120000, // Increased timeout
        });
        console.log("Login page loaded.");
        break;
      } catch (error) {
        console.log(
          `Login page navigation attempt failed, retries left: ${retries - 1}`
        );
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait before retrying
      }
    }

    // Check for CAPTCHA or block early
    const isBlocked = await page.evaluate(() => {
      return (
        !!document.querySelector(".challenge-form") ||
        document.title.includes("Verify")
      );
    });
    if (isBlocked) {
      console.log(
        "CAPTCHA or verification detected. Please solve it in the browser, then press Enter..."
      );
      await new Promise((resolve) => process.stdin.once("data", resolve));
    }

    // If login page is visible, perform login
    if (await isLoginPage(page)) {
      console.log("Login page detected, attempting to log in...");
      await loginToLinkedIn(page);
      await saveCookies(page);
    } else {
      console.log("No login page detected, assuming already logged in.");
    }

    // Navigate to the profile with retries
    console.log(`Navigating to LinkedIn profile: ${url}`);
    retries = 3;
    while (retries > 0) {
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
        console.log("Profile page loaded successfully.");
        break;
      } catch (error) {
        console.log(
          `Profile navigation attempt failed, retries left: ${retries - 1}`
        );
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    // Check for profile errors
    const isErrorPage = await page.evaluate(() => {
      return (
        !!document.querySelector(".error-page") ||
        document.title.includes("Page not found")
      );
    });
    if (isErrorPage) {
      throw new Error("Profile not accessible: Page not found or restricted.");
    }

    // Save screenshot and HTML for debugging
    await page.screenshot({ path: "linkedin_screenshot.png" });
    console.log("Screenshot saved.");
    const html = await page.content();
    fs.writeFileSync("linkedin_page.html", html);
    console.log("HTML content saved.");

    // Wait for the profile name element
    console.log("Waiting for profile name element...");
    try {
      await page.waitForSelector("h1, .text-heading-xlarge", {
        timeout: 30000,
      });
    } catch (error) {
      console.log(
        "Profile name element not found, continuing with fallback..."
      );
    }

    // Extract profile data
    const data: LinkedInProfileData | null = await page.evaluate(() => {
      console.log("Extracting LinkedIn profile data...");

      // Try JSON-LD first
      const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      for (let script of scripts) {
        try {
          const json = script.textContent
            ? JSON.parse(script.textContent)
            : null;
          if (json?.["@type"] === "Person") {
            return {
              name: json.name,
              photoUrl: json.image?.url || json.image || "No photo",
              profileUrl: json.url,
            };
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      // Fallback: extract from the page
      const name =
        document.querySelector("h1")?.textContent?.trim() ||
        document.querySelector(".text-heading-xlarge")?.textContent?.trim() ||
        "Unknown Name";
      const photoUrl =
        document
          .querySelector("img.pv-top-card-profile-picture__image--show")
          ?.getAttribute("src") ||
        document.querySelector("img.profile-photo")?.getAttribute("src") ||
        document
          .querySelector("img.profile-photo-edit__preview")
          ?.getAttribute("src") ||
        "No photo";
      const profileUrl = window.location.href;

      return { name, photoUrl, profileUrl };
    });

    if (data) {
      console.log("Found profile data:", data);
      return data;
    } else {
      console.log("No profile data found.");
    }
  } catch (error) {
    console.error("Error scraping LinkedIn profile:", error);
    await page.screenshot({ path: "scraping_error_screenshot.png" });
    fs.writeFileSync("scraping_error_page.html", await page.content());
    console.log("Scraping error screenshot and HTML saved.");
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
  return null;
}

async function isLoginPage(page: Page): Promise<boolean> {
  return (await page.$("#username")) !== null;
}

async function loginToLinkedIn(page: Page) {
  // Use environment variables for credentials
  const email = process.env.LINKEDIN_EMAIL || "";
  const password = process.env.LINKEDIN_PASSWORD || "";

  try {
    console.log("Waiting for login page to load...");
    await page.waitForSelector("#username", { timeout: 60000 });
    await page.waitForSelector("#password", { timeout: 60000 });

    console.log("Filling in login credentials...");
    await page.type("#username", email, { delay: 100 });
    await page.type("#password", password, { delay: 100 });

    console.log("Submitting login form...");
    await page.click('button[type="submit"]');

    console.log("Waiting for login to complete...");

    // Wait for navigation or profile element
    await Promise.race([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 120000 }),
      page.waitForSelector(".global-nav__me", { timeout: 120000 }),
      page.waitForSelector("#error-for-password, #error-for-username", {
        timeout: 120000,
      }),
    ]);

    // Check for login errors
    if (await page.$("#error-for-password")) {
      throw new Error("Login failed: Incorrect password.");
    }
    if (await page.$("#error-for-username")) {
      throw new Error("Login failed: Incorrect email.");
    }
    if (await isLoginPage(page)) {
      console.log(
        "Still on login page, checking for CAPTCHA or verification..."
      );
      console.log(
        "Please solve any CAPTCHA or verification in the browser, then press Enter..."
      );
      await new Promise((resolve) => process.stdin.once("data", resolve));
      if (await isLoginPage(page)) {
        throw new Error(
          "Login failed: Still on login page after manual intervention."
        );
      }
    }

    console.log("Logged in successfully.");
  } catch (error) {
    console.error("Error during login:", error);
    await page.screenshot({ path: "login_error_screenshot.png" });
    fs.writeFileSync("login_error_page.html", await page.content());
    console.log("Login error screenshot and HTML saved.");
    throw error;
  }
}

async function saveCookies(page: Page) {
  try {
    const cookies = await page.cookies();
    fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
    console.log("Cookies saved.");
  } catch (error) {
    console.error("Error saving cookies:", error);
  }
}

async function loadCookies(): Promise<any[] | null> {
  try {
    const cookies = fs.readFileSync("cookies.json", "utf-8");
    return JSON.parse(cookies);
  } catch (error) {
    console.log("No cookies found, logging in...");
    return null;
  }
}
