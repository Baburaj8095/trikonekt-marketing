import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

USER_TOK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzkwODM2NTc1LCJpYXQiOjE3OTA4MzU2NzUsImp0aSI6IjA0MmJjNTEyMzAyMzRkOTg5NzEwMWM5YmU4NmUyNDg1IiwidXNlcl9pZCI6IjUifQ.9KdzuBMlcuUXbvgobo50kAU9TZUA3WzKpVG6PjlRLj4"
ADMIN_TOK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzkwODM2NTc1LCJpYXQiOjE3OTA4MzU2NzUsImp0aSI6IjQxYjgwN2YwZDU4YTQyYjNhNTM0ODc2NjUwZTRiMjUxIiwidXNlcl9pZCI6IjEifQ.hMhnhBga3Ud4-v-LBoPnaU8_e4UlPCoyX_zPCe5FL_o"

def run_verification():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,900")
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    print("Launching headless Chrome for Live Staging Verification...")
    driver = webdriver.Chrome(options=options)
    
    BASE_URL = "https://staging-growth.growth.vin"
    screens_to_test = [
        # Public Screens
        {"path": "/", "name": "Public Home", "role": "public"},
        {"path": "/about", "name": "About Us", "role": "public"},
        {"path": "/v2/login/user", "name": "User Login", "role": "public"},
        {"path": "/v2/register/user", "name": "User Register", "role": "public"},
        {"path": "/admin/login", "name": "Admin Login", "role": "public"},

        # User Screens (with live user token)
        {"path": "/user/team-dashboard", "name": "User Community Dashboard", "role": "user"},
        {"path": "/user/genealogy-5", "name": "User Layers Blocks (Genealogy)", "role": "user"},
        {"path": "/user/team-wallet", "name": "User Community Wallet", "role": "user"},
        {"path": "/user/rank-upgrade", "name": "User Rank Upgrade", "role": "user"},
        {"path": "/user/layers-blocks", "name": "User Layers Blocks Table", "role": "user"},

        # Admin Screens (with live admin token)
        {"path": "/admin/dashboard", "name": "Admin Dashboard", "role": "admin"},
        {"path": "/admin/users", "name": "Admin Community Consumers", "role": "admin"},
        {"path": "/admin/team-consumer-block-users", "name": "Admin Block Community Consumers", "role": "admin"},
        {"path": "/admin/team-consumer-workflow", "name": "Admin Community Board", "role": "admin"},
    ]

    results = []
    
    try:
        # Initial navigation to set domain context for localStorage
        driver.get(f"{BASE_URL}/")
        time.sleep(1)

        for screen in screens_to_test:
            # Seed appropriate token before navigation
            if screen["role"] == "user":
                driver.execute_script(f"""
                    localStorage.setItem('token_user', '{USER_TOK}');
                    localStorage.setItem('token', '{USER_TOK}');
                    localStorage.setItem('role_user', 'user');
                    localStorage.setItem('role', 'user');
                    localStorage.setItem('login_context_user', 'team');
                    localStorage.setItem('user_user', JSON.stringify({{
                        id: 5,
                        username: '8095918105',
                        full_name: 'Baburaj',
                        role: 'Team Consumer',
                        phone: '8095918105'
                    }}));
                """)
            elif screen["role"] == "admin":
                driver.execute_script(f"""
                    localStorage.setItem('token_admin', '{ADMIN_TOK}');
                    localStorage.setItem('token', '{ADMIN_TOK}');
                    localStorage.setItem('role_admin', 'admin');
                    localStorage.setItem('role', 'admin');
                    localStorage.setItem('user_admin', JSON.stringify({{
                        id: 1,
                        username: 'admin',
                        role: 'admin',
                        is_superuser: true
                    }}));
                """)
            else:
                driver.execute_script("""
                    localStorage.clear();
                """)

            url = f"{BASE_URL}{screen['path']}"
            print(f"\nTesting: {screen['name']} ({screen['path']}) [Role: {screen['role']}]")
            driver.get(url)
            time.sleep(3.0) # Wait for React render & API calls

            title = driver.title
            body_text = driver.find_element(By.TAG_NAME, "body").text
            root_el = driver.find_elements(By.ID, "root")
            root_html = root_el[0].get_attribute("innerHTML") if root_el else ""

            # Check for console errors
            browser_logs = driver.get_log("browser")
            severe_errors = [
                log for log in browser_logs 
                if log["level"] == "SEVERE" 
                and not any(x in log["message"] for x in ["favicon.ico", "wishing-banners", "top-achievers"])
            ]

            # Check if root is mounted
            is_mounted = len(root_html.strip()) > 50

            # Check for broken images
            broken_imgs = driver.execute_script("""
                var imgs = document.getElementsByTagName('img');
                var broken = [];
                for (var i = 0; i < imgs.length; i++) {
                    if (imgs[i].src && imgs[i].naturalWidth === 0) {
                        broken.push(imgs[i].src);
                    }
                }
                return broken;
            """)

            # Check for error boundaries or runtime crash indicators
            has_error_boundary = any(w in body_text for w in [
                "Something went wrong", 
                "React error", 
                "Cannot read properties of undefined", 
                "Cannot read property"
            ])

            status = "PASS"
            notes = []

            if not is_mounted:
                status = "FAIL"
                notes.append("Empty #root (not mounted)")
            if has_error_boundary:
                status = "FAIL"
                notes.append("Error boundary / crash message detected")
            if severe_errors:
                status = "WARN" if status == "PASS" else status
                notes.append(f"{len(severe_errors)} JS error(s): {severe_errors[0]['message'][:100]}")
            if broken_imgs:
                status = "WARN" if status == "PASS" else status
                notes.append(f"{len(broken_imgs)} broken img(s)")

            # Check terminology presence
            if screen["role"] == "user":
                if "Community" in body_text:
                    notes.append("Verified 'Community' terminology")
                if "Layer" in body_text:
                    notes.append("Verified 'Layer' terminology")
            elif screen["role"] == "admin":
                if "Community" in body_text or "Layer" in body_text:
                    notes.append("Verified Admin Community terminology")

            print(f"Result: [{status}] | Title: '{title}' | DOM: {len(root_html)} chars")
            if notes:
                print(f"Details: {'; '.join(notes)}")

            results.append({
                "name": screen["name"],
                "path": screen["path"],
                "status": status,
                "notes": notes,
                "title": title
            })

    finally:
        driver.quit()

    print("\n" + "="*60)
    print("END-TO-END SCREEN VERIFICATION RESULTS")
    print("="*60)
    all_passed = True
    for r in results:
        mark = "[PASS]" if r["status"] == "PASS" else ("[WARN]" if r["status"] == "WARN" else "[FAIL]")
        print(f"{mark} {r['name']} ({r['path']}): {', '.join(r['notes']) if r['notes'] else 'OK'}")
        if r["status"] == "FAIL":
            all_passed = False

    print("\nOVERALL STATUS: " + ("ALL SCREENS PASSED CLEANLY" if all_passed else "SOME SCREENS FAILED"))

if __name__ == "__main__":
    run_verification()
