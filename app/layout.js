import './globals.css';
import Nav from './components/Nav';

export const metadata = { title: 'CP Judge' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
