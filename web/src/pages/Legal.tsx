import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icons';
import { Footer } from '../components/Footer';

/**
 * Draft legal pages. Everything in [brackets] is a placeholder for the owner to fill in, and every page
 * needs a legal review before public launch. Edit the values here once; they appear on every page.
 */
const P = {
  business: '[Business or owner name]',
  address: '[Registered address, City, State, PIN]',
  supportEmail: '[support@weyvo.in]',
  grievanceName: '[Grievance Officer name]',
  grievanceEmail: '[grievance@weyvo.in]',
  city: '[City]',
  refundDays: '[7]',
  updated: '[Date of last update]',
};

const Ph = ({ children }: { children: ReactNode }) => (
  <mark style={{ background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-fg)', padding: '0 4px', borderRadius: 4 }}>{children}</mark>
);

const PAGES: Record<string, { title: string; body: ReactNode }> = {
  terms: {
    title: 'Terms of Use',
    body: (
      <>
        <p>These terms are an agreement between you and <Ph>{P.business}</Ph> ("Weyvo", "we"). By creating an account or using Weyvo, you agree to them.</p>
        <h2>1. Who can use Weyvo</h2>
        <p>You must be at least 18 years old. You're responsible for your account and for keeping your password safe. One person, one account.</p>
        <h2>2. Your content</h2>
        <p>You own the stories, photos, comments and questions you post. By posting, you give Weyvo a non-exclusive, worldwide, royalty-free licence to host, display and share them on Weyvo according to the visibility you choose (public, unlisted or private), and to make technical copies needed to run the service. This licence ends when you delete the content or your account, except for copies others already shared or that we must keep by law.</p>
        <p>Only post content you have the right to post. Don't post other people's photos or private information without their permission.</p>
        <h2>3. What's not allowed</h2>
        <p>Illegal content; harassment, hate or threats; sexual content involving minors; impersonation; spam, fake engagement or scraping; malware; content that infringes someone else's rights; attempts to break or bypass our security or limits. See the <Link to="/legal/guidelines">Community Guidelines</Link>.</p>
        <h2>4. Moderation</h2>
        <p>Authors can hide or delete comments and questions on their stories. Anyone can report content. We may remove content or suspend accounts that break these terms or the law, and we act on valid legal requests and complaints as required by Indian law.</p>
        <h2>5. Premium</h2>
        <p>Premium is a one-time purchase for a fixed period (one month or one year) and does not renew automatically. Prices are shown before payment and include applicable taxes. Payments are processed by Razorpay. Refunds follow the <Link to="/legal/refunds">Refund and Cancellation Policy</Link>. When Premium ends, Free limits apply again; your content stays.</p>
        <h2>6. Ending your account</h2>
        <p>You can download your data and delete your account any time in Settings. We may suspend or end accounts for serious or repeated violations.</p>
        <h2>7. Disclaimers and liability</h2>
        <p>Travel information on Weyvo is shared by users and may be wrong or out of date; check before you travel. Weyvo is provided "as is". To the extent the law allows, we aren't liable for indirect or consequential losses, and our total liability is limited to the amount you paid us in the 12 months before the claim.</p>
        <h2>8. Changes</h2>
        <p>We may update these terms. For significant changes we'll notify you in the app or by email before they take effect.</p>
        <h2>9. Law and disputes</h2>
        <p>These terms are governed by the laws of India. Courts at <Ph>{P.city}</Ph> have jurisdiction.</p>
        <h2>10. Contact</h2>
        <p>Questions or complaints: <Ph>{P.supportEmail}</Ph>. Grievance Officer: see <Link to="/legal/contact">Contact</Link>.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p>This policy explains how <Ph>{P.business}</Ph> handles your personal data under India's Digital Personal Data Protection Act, 2023.</p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account:</strong> email, username, display name, password (stored only as a secure hash), optional bio and profile picture.</li>
          <li><strong>Your content:</strong> stories, photos, captions, comments, questions, reactions and follows. Photo location and camera data (EXIF) are removed when you upload.</li>
          <li><strong>Payments:</strong> plan, amount and Razorpay order and payment IDs. We never see or store card or UPI details.</li>
          <li><strong>Security and service logs:</strong> sign-in events, rate-limit counters (stored as one-way hashes of IP addresses and emails) and error logs. Logs never contain passwords, codes or message contents.</li>
        </ul>
        <h2>Why we use it</h2>
        <p>To run your account and show your stories as you choose; to send verification and password codes; to process Premium payments; to keep Weyvo safe (limits, moderation, fraud prevention); and to meet legal obligations.</p>
        <h2>Who processes it for us</h2>
        <p>Supabase (database and photo storage), Render (hosting), Resend (email), Razorpay (payments), and, if you allow analytics, PostHog (usage analytics) and Sentry (error reports). They process data only to provide their service to us.</p>
        <h2>How long we keep it</h2>
        <p>While your account is active. When you delete your account, your stories, photos, comments, reactions and follows are deleted straight away; payment records are kept as long as tax law requires; security logs are kept for <Ph>[90 days]</Ph>.</p>
        <h2>Your rights</h2>
        <ul>
          <li><strong>Access:</strong> download all your data in Settings → Your data.</li>
          <li><strong>Correction:</strong> edit your profile and stories at any time.</li>
          <li><strong>Erasure:</strong> delete stories or your whole account in Settings.</li>
          <li><strong>Grievance:</strong> contact our Grievance Officer (see <Link to="/legal/contact">Contact</Link>). You may also approach the Data Protection Board of India.</li>
        </ul>
        <h2>Children</h2>
        <p>Weyvo is for people aged 18 and over. We don't knowingly collect data from children.</p>
        <h2>Cookies</h2>
        <p>We use one essential cookie to keep you signed in. Optional analytics cookies are used only if you agree.</p>
        <h2>Security</h2>
        <p>Passwords are hashed, sessions can be ended on all devices, private stories and their photos are only served to their owner, and access is checked on every request. If a breach affects you, we'll notify you and the authorities as the law requires.</p>
        <h2>Contact</h2>
        <p><Ph>{P.supportEmail}</Ph> · <Ph>{P.address}</Ph></p>
      </>
    ),
  },
  refunds: {
    title: 'Refund and Cancellation Policy',
    body: (
      <>
        <p>Premium is sold as a one-time purchase for one month or one year. It does not renew automatically, so there's nothing to cancel.</p>
        <h2>Refunds</h2>
        <p>You can ask for a full refund within <Ph>{P.refundDays}</Ph> days of purchase by writing to <Ph>{P.supportEmail}</Ph> with your Weyvo username and the payment date. Approved refunds go back to the original payment method through Razorpay, usually within 5–7 working days. When a refund is issued, Premium ends.</p>
        <h2>Failed or duplicate payments</h2>
        <p>If you were charged but Premium wasn't applied, or you were charged twice, write to us and we'll fix it or refund the extra payment.</p>
        <h2>Price changes</h2>
        <p>New prices apply to future purchases only, never to time you've already paid for.</p>
      </>
    ),
  },
  guidelines: {
    title: 'Community Guidelines',
    body: (
      <>
        <p>Weyvo is a calm place to share real journeys. These guidelines keep it that way.</p>
        <h2>Do</h2>
        <ul>
          <li>Share your own trips, photos and honest experiences.</li>
          <li>Be kind in comments and questions. Disagree respectfully.</li>
          <li>Credit others and ask before posting photos of people.</li>
        </ul>
        <h2>Don't</h2>
        <ul>
          <li>Harass, threaten, or post hate based on who someone is.</li>
          <li>Spam, advertise without disclosure, or fake engagement.</li>
          <li>Post others' private information, or photos you don't have rights to.</li>
          <li>Post sexual, violent or illegal content, or anything involving minors in a harmful way.</li>
          <li>Encourage unsafe or illegal travel behaviour.</li>
        </ul>
        <h2>Reporting</h2>
        <p>Use Report on any comment or question. Content reported by several people is hidden automatically while we review it. Authors can hide or delete comments on their own stories. Repeated or serious violations can lead to suspension.</p>
      </>
    ),
  },
  contact: {
    title: 'Contact and Grievance Officer',
    body: (
      <>
        <h2>Support</h2>
        <p>Email <Ph>{P.supportEmail}</Ph>. We reply within <Ph>[2 working days]</Ph>.</p>
        <h2>Grievance Officer</h2>
        <p>Under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the DPDP Act, 2023:</p>
        <p><Ph>{P.grievanceName}</Ph><br /><Ph>{P.grievanceEmail}</Ph><br /><Ph>{P.address}</Ph></p>
        <p>We acknowledge complaints within 24 hours and resolve them within 15 days.</p>
        <h2>Business details</h2>
        <p><Ph>{P.business}</Ph><br /><Ph>{P.address}</Ph></p>
      </>
    ),
  },
};

export function Legal() {
  const { page = '' } = useParams();
  const doc = PAGES[page];
  if (!doc) return <Navigate to="/legal/terms" replace />;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px 40px' }}>
      <div className="topbar" style={{ padding: '14px 0 4px' }}>
        <Link to="/" className="icon-btn" aria-label="Home"><Icon.back /></Link>
        <span className="display" style={{ fontSize: 22 }}>weyvo<span style={{ color: 'var(--gold)' }}>.</span></span>
        <span style={{ width: 44 }} />
      </div>
      <p role="note" className="paper-card" style={{ fontSize: 13, color: 'var(--chip-gold-fg)', background: 'var(--chip-gold-bg)' }}>
        Draft for review. Highlighted parts are placeholders, and this text needs a legal review before launch.
      </p>
      <article className="legal">
        <h1 className="display" style={{ fontSize: 40, margin: '18px 0 4px' }}>{doc.title}</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Last updated: <Ph>{P.updated}</Ph></p>
        {doc.body}
      </article>
      <Footer />
    </div>
  );
}
