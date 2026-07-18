// Structured content for the in-app Terms of Service and Privacy Policy
// pages (src/components/legal/LegalPage.tsx). Kept as data rather than
// hardcoded JSX so updating a clause is a text edit here, not a dive into
// the animated page component itself.
//
// This mirrors the standalone PDF versions (Ashutosh Behera / Bhubaneswar,
// Odisha / kiwieatspumpkin@gmail.com / Groq Inc. / Supabase Tokyo region),
// kept in sync by hand — if the PDFs are regenerated with different real
// details, update both places.

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'table'; rows: [string, string][] }
  | { type: 'callout'; text: string; tone?: 'default' | 'accent' };

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  docType: string;
  title: string;
  tagline: string;
  effectiveDate: string;
  sections: LegalSection[];
}

export const TERMS_DOC: LegalDoc = {
  docType: 'Legal Agreement',
  title: 'Terms of Service',
  tagline: 'Akyos — Your Answer to Chaos',
  effectiveDate: '21 July 2026',
  sections: [
    {
      title: 'Who This Agreement Is Between',
      blocks: [
        { type: 'p', text: 'These Terms of Service ("Terms") are a legally binding agreement between you ("you", "User") and Ashutosh Behera, operating individually from Bhubaneswar, Odisha, India ("Akyos", "we", "us", "our"), the creator and operator of the Akyos application (web and installable PWA, together the "App" or "Service").' },
        { type: 'p', text: 'By creating an account, or by accessing or using the App in any way, you agree to be bound by these Terms and by our Privacy Policy, which is incorporated into these Terms by reference. If you do not agree, do not use the App.' },
      ],
    },
    {
      title: 'Eligibility and Use by Minors',
      blocks: [
        { type: 'p', text: 'Akyos is designed to be usable by people of school and college age (for example, students preparing for exams such as JEE, NEET, or UPSC), as well as adults. There is no minimum age to use the App, but the following conditions apply.' },
        { type: 'p', text: 'If you are under 18 years of age: under the Indian Contract Act, 1872, a minor cannot enter into a binding contract in their own capacity. Accordingly:' },
        { type: 'ul', items: [
          'you may only use the App if a parent or lawful guardian has reviewed these Terms and our Privacy Policy and consents, on your behalf, to your use of the App and to the processing of your personal data as described in the Privacy Policy;',
          'your parent or lawful guardian is treated as the party accepting these Terms on your behalf and is responsible for your compliance with them;',
          'some features (for example connecting a payment method, if paid plans are ever introduced) may be restricted to users who can demonstrate they are 18 or older.',
        ] },
        { type: 'p', text: 'By using the App, you represent that you are either 18 years of age or older, or that you have obtained the consent described above. We reserve the right to request age or guardian-consent confirmation and to suspend an account where we reasonably believe this has not been complied with.' },
        { type: 'callout', text: 'In accordance with Section 9 of the Digital Personal Data Protection Act, 2023, we do not knowingly track or behaviourally monitor children, or target advertising at users we know to be children, and we do not process a child\u2019s personal data in a manner likely to cause detriment to their well-being.' },
      ],
    },
    {
      title: 'Description of the Service',
      blocks: [
        { type: 'p', text: 'Akyos is a personal goal-tracking tool. Depending on the goal domain(s) you select at onboarding (exam/certification preparation, fitness, diet/nutrition, productivity, or a custom goal), the App generates checklists, timelines, targets, training plans, diet plans, and/or exam syllabi, and lets you log progress (e.g. mock test scores, weight, meals, study time).' },
        { type: 'p', text: 'Some content shown in the App (topic breakdowns, exercise guidance, starter plans) is generated automatically, including with the assistance of artificial intelligence / large language model technology. Where AI generation is unavailable or fails, the App uses a built-in local fallback so you are not left without content.' },
        { type: 'callout', text: 'Nothing in the App requires you to hand over personal information beyond what\u2019s needed to create an account. Your name, birthdate, goal profile, and every log (diet, weight, study, mock tests) are optional fields you choose whether to fill in \u2014 you can skip onboarding entirely and use the App with defaults.', tone: 'accent' },
      ],
    },
    {
      title: 'Not Medical, Dietary, Financial, or Professional Advice',
      blocks: [
        { type: 'callout', text: 'Akyos is an organisational and motivational tool. It is not, and must not be treated as, medical, nutritional, fitness, psychological, financial, or exam-counselling advice.' },
        { type: 'p', text: 'Any diet plan, calorie/macro estimate, training plan, exercise instruction, weight tracking feature, study plan, or exam strategy shown in the App \u2014 whether AI-generated or a built-in default \u2014 is generic, informational content only, and has not been reviewed by a doctor, dietitian, certified trainer, or subject-matter expert unless we expressly state otherwise.' },
        { type: 'p', text: 'Before starting any diet, fitness, or exercise programme, or making any change based on content in the App, you should consult a qualified physician, dietitian, or medical professional \u2014 particularly if you are a minor, are pregnant, have a pre-existing medical condition, or have a history of disordered eating.' },
        { type: 'p', text: 'We are not liable for any injury, illness, adverse health outcome, exam result, or other consequence arising from your reliance on content generated or displayed by the App. AI-generated content may occasionally be inaccurate or unsuitable for your circumstances \u2014 you are responsible for exercising independent judgment.' },
      ],
    },
    {
      title: 'Your Account',
      blocks: [
        { type: 'p', text: 'You may create an account using an email address and password, or by continuing with Google Sign-In. You must provide accurate information and keep your login credentials confidential.' },
        { type: 'p', text: 'The App additionally offers an optional 6-digit in-app passcode as a local lock for the App on your device. We store only a cryptographically salted and hashed (PBKDF2) form of your passcode \u2014 never the passcode itself.' },
        { type: 'p', text: 'You are responsible for all activity under your account. Notify us immediately at kiwieatspumpkin@gmail.com if you suspect unauthorised access.' },
        { type: 'p', text: 'We reserve the right to suspend or terminate accounts we reasonably believe are being used fraudulently, abusively, or in violation of these Terms or applicable law.' },
      ],
    },
    {
      title: 'Account Deletion',
      blocks: [
        { type: 'p', text: 'You may permanently delete your account and associated data at any time from within the App, by re-entering your passcode and typing "DELETE" to confirm. Deletion removes your cloud-stored data (configuration, logs, and passcode hash) and your login itself, immediately and irreversibly.' },
        { type: 'p', text: 'We may retain limited information after deletion only where required to comply with a legal obligation, resolve a dispute, or enforce our agreements, and only for as long as necessary.' },
      ],
    },
    {
      title: 'Acceptable Use',
      blocks: [
        { type: 'p', text: 'You agree not to:' },
        { type: 'ul', items: [
          'use the App for any unlawful purpose or in violation of any Indian law, including the Information Technology Act, 2000;',
          'attempt to gain unauthorised access to another user\u2019s account or data, or to our servers or infrastructure;',
          'reverse-engineer, decompile, or attempt to extract the source code of the App, except where prohibited by law;',
          'use automated means (bots, scrapers) to access the App without our written permission;',
          'upload or input any content that is unlawful, defamatory, obscene, or that infringes a third party\u2019s rights;',
          'interfere with or disrupt the App, including attempting to bypass rate limits or lockout mechanisms.',
        ] },
      ],
    },
    {
      title: 'Intellectual Property',
      blocks: [
        { type: 'p', text: 'The App, including its design, branding, source code, and built-in content libraries (excluding data you input), is owned by Ashutosh Behera and protected under the Copyright Act, 1957 and other applicable IP laws. Nothing in these Terms transfers ownership of the App to you.' },
        { type: 'p', text: 'You retain ownership of the personal data and content you input into the App. You grant us a limited licence to host, store, process, and display that content solely to operate and improve the Service for you.' },
      ],
    },
    {
      title: 'Third-Party Services',
      blocks: [
        { type: 'p', text: 'The App relies on Supabase (authentication and cloud database hosting) and Google (optional sign-in) to operate. If and when features such as Spotify or Strava integration are enabled, connecting those accounts will only occur with your explicit action (OAuth authorisation).' },
        { type: 'p', text: 'We are not responsible for the availability, content, or practices of third-party services. Your use of any third-party integration is at your own discretion and risk.' },
      ],
    },
    {
      title: 'Subscriptions and Payments',
      blocks: [
        { type: 'callout', text: 'Currently free \u2014 no payments, subscriptions, or in-app purchases of any kind, with no plans to change that.', tone: 'accent' },
        { type: 'p', text: 'Should this ever change, this section will be updated before any payment feature is enabled, with full pricing, billing, and cancellation/refund terms as required under the Consumer Protection (E-Commerce) Rules, 2020.' },
      ],
    },
    {
      title: 'Disclaimer of Warranties',
      blocks: [
        { type: 'p', text: 'The App is provided on an "as is" and "as available" basis. To the maximum extent permitted by applicable law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, accuracy, and non-infringement. We do not warrant the App will be uninterrupted, error-free, or entirely secure, or that AI-generated content will be accurate or suitable for your needs.' },
      ],
    },
    {
      title: 'Limitation of Liability',
      blocks: [
        { type: 'p', text: 'To the maximum extent permitted under applicable Indian law, Ashutosh Behera shall not be liable for any indirect, incidental, special, consequential, or exemplary damages, or for any loss of data, health outcome, exam outcome, or profit, arising out of your use of the App.' },
        { type: 'p', text: 'Nothing in these Terms limits or excludes liability that cannot lawfully be limited or excluded under Indian law, including liability for fraud or wilful misconduct.' },
        { type: 'p', text: 'As the App is provided entirely free of charge, our aggregate liability to you for all claims arising out of or relating to the App shall not exceed \u20b95,000 (Indian Rupees five thousand).' },
      ],
    },
    {
      title: 'Indemnification',
      blocks: [
        { type: 'p', text: 'You agree to indemnify and hold harmless Ashutosh Behera from any claim, loss, or demand, including reasonable legal fees, arising out of your breach of these Terms, your misuse of the App, or your violation of any law or third-party right.' },
      ],
    },
    {
      title: 'Grievance Redressal',
      blocks: [
        { type: 'p', text: 'In accordance with the Information Technology Act, 2000 and rules made thereunder, and the Digital Personal Data Protection Act, 2023, the following Grievance Officer may be contacted for any complaints:' },
        { type: 'table', rows: [
          ['Grievance Officer', 'Ashutosh Behera'],
          ['Email', 'kiwieatspumpkin@gmail.com'],
          ['Address', 'Bhubaneswar, Odisha, India'],
          ['Response time', 'Acknowledged within 24 hours; resolved within 15 days (1 month for privacy grievances).'],
        ] },
      ],
    },
    {
      title: 'Governing Law and Jurisdiction',
      blocks: [
        { type: 'p', text: 'These Terms are governed by the laws of India. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts at Bhubaneswar, Odisha, India.' },
      ],
    },
    {
      title: 'Changes to These Terms',
      blocks: [
        { type: 'p', text: 'We may update these Terms from time to time. Where a change is material, we will make reasonable efforts to notify you in-app or by email before it takes effect. Continued use of the App after an update constitutes acceptance of the revised Terms.' },
      ],
    },
    {
      title: 'Contact Us',
      blocks: [
        { type: 'p', text: 'For any questions about these Terms, contact us at kiwieatspumpkin@gmail.com.' },
      ],
    },
  ],
};

export const PRIVACY_DOC: LegalDoc = {
  docType: 'Legal Agreement',
  title: 'Privacy Policy',
  tagline: 'Akyos — Your Answer to Chaos',
  effectiveDate: '21 July 2026',
  sections: [
    {
      title: 'Who We Are',
      blocks: [
        { type: 'p', text: 'This Privacy Policy explains how Ashutosh Behera, operating individually from Bhubaneswar, Odisha, India ("Akyos", "we", "us"), the Data Fiduciary in relation to your personal data under the Digital Personal Data Protection Act, 2023 ("DPDPA"), collects, uses, stores, shares, and protects information when you use the Akyos application ("App").' },
        { type: 'p', text: 'This Policy should be read together with our Terms of Service.' },
      ],
    },
    {
      title: 'Nothing Here Is Mandatory Beyond Signing In',
      blocks: [
        { type: 'callout', text: 'To create an account you need an email address and a password, or a Google sign-in. That is the only data Akyos ever requires. Every other field \u2014 your name, birthdate, goal domain, exam name, fitness/diet profile, and every log you make \u2014 is entirely optional. You can skip onboarding in full, leave any field blank, and use the App with its defaults.', tone: 'accent' },
      ],
    },
    {
      title: 'What We Collect',
      blocks: [
        { type: 'table', rows: [
          ['Account / identity', 'Email address; Google account identifier and basic profile if you sign in with Google'],
          ['Onboarding & goal profile', 'Goal domain(s), exam name/level, fitness/diet profile, activity level \u2014 all optional'],
          ['Activity & progress logs', 'Mock test scores, revision history, to-dos, focus timer, diet & weight logs \u2014 all optional'],
          ['Security credentials', 'Password (never visible to us in plain text); optional 6-digit passcode, stored only as a salted PBKDF2 hash'],
          ['Technical & security data', 'IP address (rate-limiting/abuse prevention only), device/browser type, session tokens'],
          ['Local app data', 'App configuration and cached AI-generated content, synced across your devices'],
        ] },
        { type: 'p', text: 'We do not collect: payment card details (no payments are processed), precise real-time location, biometric identifiers, or government ID numbers.' },
      ],
    },
    {
      title: 'Sensitive Personal Data — Special Note',
      blocks: [
        { type: 'p', text: 'Certain data you may choose to enter \u2014 in particular weight logs, diet logs, and other health-adjacent information \u2014 may constitute "sensitive personal data" under Rule 3 of the IT (SPDI) Rules, 2011, and personal data the DPDPA treats with heightened care.' },
        { type: 'p', text: 'We collect and process this category of data only if and when you voluntarily use the diet or fitness features. You may decline to use these features, in which case this data is simply never collected. You can delete any entry, or your entire account, at any time.' },
        { type: 'p', text: 'We do not use health-adjacent data for advertising, do not sell it, and do not share it with any third party except the infrastructure providers described below, who process it strictly on our behalf.' },
      ],
    },
    {
      title: 'How We Use Your Data',
      blocks: [
        { type: 'p', text: 'We use your data to: create and operate your account and keep it in sync across devices; generate the checklists, timelines, diet plans, training plans, and syllabi the App is built around, including via AI content generation; secure your account (passcode verification, lockout, rate limiting, fraud/abuse prevention); respond to support requests and grievances; and comply with legal obligations.' },
        { type: 'callout', text: 'No behavioural advertising. No sale of data. Ever.', tone: 'accent' },
      ],
    },
    {
      title: 'AI-Generated Content and Your Data',
      blocks: [
        { type: 'p', text: 'When you add a new exam topic, exercise, or goal the App doesn\u2019t already have content for, the relevant text you provide is sent to Groq Inc., a third-party AI inference provider, to produce explanatory content. This happens through a server-side function we control; Groq does not receive your name, email, or account identifiers \u2014 only the specific topic/exercise text.' },
        { type: 'p', text: 'Per Groq\u2019s published data terms, inference requests are not retained or used to train Groq\u2019s models by default; Groq may briefly log inputs/outputs (up to ~30 days) only for troubleshooting or abuse investigation. Groq processes data on infrastructure located in the United States.' },
        { type: 'p', text: 'Generated content is cached and reused so the same input is not sent again. If AI generation fails or is unavailable, the App falls back to built-in, non-AI-generated content automatically.' },
      ],
    },
    {
      title: 'Who We Share Data With',
      blocks: [
        { type: 'table', rows: [
          ['Supabase', 'Authentication, database hosting, cloud sync, serverless functions \u2014 all account and app data'],
          ['Google (optional)', 'Sign-in ("Continue with Google") \u2014 basic profile info you choose to share'],
          ['Groq Inc.', 'Generating educational/plan content \u2014 the specific topic/exercise text only, not your identity'],
        ] },
        { type: 'p', text: 'We do not share your data with advertisers or data brokers. We may disclose data where required by law, court order, or a lawful request from a government authority, or to protect our legal rights.' },
      ],
    },
    {
      title: 'Where Your Data Is Stored — Cross-Border Transfer',
      blocks: [
        { type: 'p', text: 'Your account and app data is stored on Supabase infrastructure located in Tokyo, Japan (ap-northeast-1). Content-generation requests are processed by Groq Inc. on infrastructure located in the United States. Both are outside India.' },
        { type: 'p', text: 'Under Section 16 of the DPDPA, cross-border transfer of personal data is permitted by default, except to countries the Central Government specifically restricts by notification. As of the date of this Policy, no such restriction affects Japan or the United States.' },
      ],
    },
    {
      title: 'Children\u2019s Data',
      blocks: [
        { type: 'p', text: 'Akyos may be used by minors (users under 18), for example students preparing for competitive exams.' },
        { type: 'p', text: 'In accordance with Section 9 of the DPDPA, where we have actual knowledge that a user is a child, we will process that child\u2019s personal data only with the verifiable consent of a parent or lawful guardian, will not undertake tracking, behavioural monitoring, or targeted advertising directed at that child, and will not process the child\u2019s data in any manner likely to cause detriment to their well-being.' },
        { type: 'p', text: 'A parent or guardian who wishes to review, correct, or request deletion of their child\u2019s data may do so through the account-deletion feature in the App, or by contacting our Grievance Officer.' },
      ],
    },
    {
      title: 'Your Rights',
      blocks: [
        { type: 'p', text: 'Under the DPDPA, you (or, for a child, their parent/guardian) have the right to:' },
        { type: 'ul', items: [
          'obtain a summary of the personal data we hold about you and the processing activities undertaken;',
          'request correction, completion, or updating of your personal data;',
          'request erasure \u2014 you can do this yourself at any time via the in-app account-deletion feature;',
          'withdraw consent at any time, as easily as it was given;',
          'nominate another individual to exercise these rights on your behalf in the event of your death or incapacity;',
          'file a grievance with us and, if unresolved, escalate it to the Data Protection Board of India.',
        ] },
        { type: 'p', text: 'To exercise these rights, contact us at kiwieatspumpkin@gmail.com.' },
      ],
    },
    {
      title: 'Data Retention',
      blocks: [
        { type: 'p', text: 'We retain your personal data for as long as your account is active. If you delete your account, your cloud-stored data (configuration, logs, passcode hash) is deleted from our production database immediately, with no automatic backups currently configured to leave a lingering copy.' },
      ],
    },
    {
      title: 'Cookies & Local Storage',
      blocks: [
        { type: 'p', text: 'Akyos is a Progressive Web App and primarily uses your browser\u2019s local storage \u2014 not third-party advertising cookies \u2014 to stay fast and work offline. This locally stored data is limited to your own app configuration and cached content, synced only to your own account. We use no third-party advertising trackers.' },
      ],
    },
    {
      title: 'Security Measures',
      blocks: [
        { type: 'ul', items: [
          'Passwords are managed by our authentication provider and never stored by us in plain text.',
          'Your app-lock passcode is hashed using PBKDF2 (150,000 iterations, SHA-256, random per-user salt) \u2014 never stored in plain text.',
          'Sensitive actions (account deletion, passcode change) require independent server-side verification, not just a valid session token.',
          'Server-side, account-bound rate limiting and escalating lockout resist brute-force and abuse.',
          'Data is encrypted in transit (HTTPS/TLS).',
          'Account isolation logic prevents a new sign-in on a shared device from inheriting a previous account\u2019s locally cached data.',
        ] },
        { type: 'p', text: 'No system is completely secure. In the event of a personal data breach, we will notify the Data Protection Board of India and affected users without undue delay, as required under the DPDPA and its Rules.' },
      ],
    },
    {
      title: 'Grievance Officer',
      blocks: [
        { type: 'table', rows: [
          ['Grievance Officer', 'Ashutosh Behera'],
          ['Email', 'kiwieatspumpkin@gmail.com'],
          ['Address', 'Bhubaneswar, Odisha, India'],
          ['Response time', 'Acknowledged within 24 hours; resolved within 1 month.'],
        ] },
      ],
    },
    {
      title: 'Changes to This Policy',
      blocks: [
        { type: 'p', text: 'We may update this Privacy Policy from time to time, including as the DPDPA\u2019s phased provisions come fully into force (by 14 May 2027) or as our AI provider, hosting region, or feature set changes. Material changes will be notified in-app or by email before they take effect.' },
      ],
    },
    {
      title: 'Contact Us',
      blocks: [
        { type: 'p', text: 'For any question about this Policy or your personal data, contact us at kiwieatspumpkin@gmail.com.' },
      ],
    },
  ],
};
