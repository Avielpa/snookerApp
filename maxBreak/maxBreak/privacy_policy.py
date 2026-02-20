from django.http import HttpResponse


PRIVACY_POLICY_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Privacy Policy – MaxBreak Snooker</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      color: #1a1a1a;
      line-height: 1.7;
    }
    h1 { color: #FF8F00; font-size: 2em; margin-bottom: 4px; }
    h2 { color: #333; margin-top: 32px; font-size: 1.2em; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    p, li { color: #444; }
    ul { padding-left: 20px; }
    .updated { color: #888; font-size: 0.9em; margin-bottom: 32px; }
    a { color: #FF8F00; }
    footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #eee; color: #888; font-size: 0.85em; }
  </style>
</head>
<body>
  <h1>MaxBreak Snooker</h1>
  <p class="updated">Privacy Policy &mdash; Last updated: February 2026</p>

  <h2>1. Overview</h2>
  <p>
    MaxBreak Snooker ("the App") is a snooker tournament tracker that provides live match scores,
    player rankings, tournament schedules, and player statistics sourced from the public
    snooker.org data feed. This Privacy Policy explains what information we collect, how we
    use it, and your rights regarding that information.
  </p>

  <h2>2. Information We Collect</h2>
  <ul>
    <li><strong>Account information:</strong> If you register, we collect your email address and a
        hashed password for authentication purposes only.</li>
    <li><strong>Usage data:</strong> Basic app activity such as screens viewed. This is used solely
        to improve app stability and is not linked to your identity.</li>
    <li><strong>Device information:</strong> Device type and operating system version, used only for
        compatibility and performance optimisation.</li>
  </ul>
  <p>We do <strong>not</strong> collect your location, contacts, camera, microphone, or any
     sensitive personal data.</p>

  <h2>3. How We Use Your Information</h2>
  <ul>
    <li>To provide and operate the App (authentication, personalised experience).</li>
    <li>To send push notifications about live matches (only if you grant permission).</li>
    <li>To diagnose crashes and fix bugs.</li>
  </ul>
  <p>We do <strong>not</strong> sell, trade, or rent your personal information to third parties.</p>

  <h2>4. Third-Party Data Sources</h2>
  <p>
    Match, player, and tournament data is sourced from the publicly available
    <a href="https://www.snooker.org" target="_blank">snooker.org</a> API.
    We do not control the content of that service.
  </p>

  <h2>5. Push Notifications</h2>
  <p>
    The App may send push notifications about live matches and tournament updates.
    You can disable these at any time in your device Settings &rarr; Notifications.
  </p>

  <h2>6. Data Retention</h2>
  <p>
    Account data is retained for as long as your account is active. You may request
    deletion of your account and associated data at any time by contacting us.
  </p>

  <h2>7. Security</h2>
  <p>
    We use industry-standard measures including JWT authentication and HTTPS encryption
    to protect your data in transit and at rest.
  </p>

  <h2>8. Children's Privacy</h2>
  <p>
    The App is not directed at children under the age of 13. We do not knowingly collect
    personal information from children.
  </p>

  <h2>9. Changes to This Policy</h2>
  <p>
    We may update this Privacy Policy from time to time. Changes will be posted on this page
    with an updated date. Continued use of the App after changes constitutes acceptance.
  </p>

  <h2>10. Contact Us</h2>
  <p>
    If you have any questions about this Privacy Policy or wish to request data deletion,
    please contact us at:
    <a href="mailto:avielpahima@gmail.com">avielpahima@gmail.com</a>
  </p>

  <footer>
    &copy; 2026 MaxBreak Snooker &mdash; All rights reserved.
  </footer>
</body>
</html>"""


def privacy_policy_view(request):
    return HttpResponse(PRIVACY_POLICY_HTML, content_type='text/html; charset=utf-8')
