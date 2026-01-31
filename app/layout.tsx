export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>BGR Dashboard - Process Manager</title>
                <meta name="description" content="BGR - Bun Background Runner - A modern process manager dashboard" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body>
                <div className="container">
                    <header>
                        <div className="logo">
                            <div className="logo-icon">⚡</div>
                            <div>
                                <h1>BGR</h1>
                                <span>Background Runner</span>
                            </div>
                        </div>
                        <div className="header-actions">
                            <div className="search-refresh">
                                <a href="/" className="btn btn-ghost refresh-btn" title="Refresh">
                                    🔄 Refresh
                                </a>
                            </div>
                        </div>
                    </header>
                    <main id="melina-page-content">{children}</main>
                </div>
            </body>
        </html>
    );
}
