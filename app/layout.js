import './globals.css';
import Nav from './components/Nav';

export const metadata = { title: 'CP Judge' };

// Runs before the page paints, so a saved dark choice never flashes white.
// Order: saved choice, then the system setting, then light.
const themeInit = `try{var t=localStorage.getItem('theme');
if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body>
        <Nav />
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
