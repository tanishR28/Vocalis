import './globals.css';
import OnboardingGate from './components/OnboardingGate';
import AppLayout from './components/AppLayout';
import { AuthProvider } from '../lib/auth/AuthProvider';
import ApiAuthBridge from './components/ApiAuthBridge';

export const metadata = {
  title: 'Vocalis',
  description: 'AI-powered voice biomarker monitoring',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="light">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <ApiAuthBridge />
          <OnboardingGate>
            <AppLayout>{children}</AppLayout>
          </OnboardingGate>
        </AuthProvider>
      </body>
    </html>
  );
}
