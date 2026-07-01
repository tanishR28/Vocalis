import './globals.css';
import OnboardingGate from './components/OnboardingGate';
import AppLayout from './components/AppLayout';

export const metadata = {
  title: 'Vocalis Health Dashboard',
  description: 'AI Health Assessment Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="light">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <OnboardingGate>
          <AppLayout>{children}</AppLayout>
        </OnboardingGate>
      </body>
    </html>
  );
}
