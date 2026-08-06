export function BrandPanel() {
  return (
    <div className="login-brand">
      <svg className="lb-route" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-20 480 C 80 470, 90 330, 180 300 S 300 210, 300 90 S 360 -10, 460 20"
          fill="none" stroke="#1d4ed8" strokeWidth="1.5" opacity=".5" />
        <path className="trace" d="M-20 480 C 80 470, 90 330, 180 300 S 300 210, 300 90 S 360 -10, 460 20"
          fill="none" stroke="#4f7fff" strokeWidth="2" />
        <circle cx="180" cy="300" r="4" fill="#4f7fff" />
        <circle cx="300" cy="90" r="4" fill="#4f7fff" />
      </svg>

      <div className="lb-top">
        <div className="mark">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M12 9.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4M7.8 8a6 6 0 0 0 0 8M16.2 8a6 6 0 0 1 0 8M4.6 4.8a10.4 10.4 0 0 0 0 14.4M19.4 4.8a10.4 10.4 0 0 1 0 14.4" />
          </svg>
        </div>
        <div className="lb-name">AI Logistics<br />Operating System</div>
      </div>

      <div className="lb-mid">
        <h1 className="lb-head">One ledger. Two sides of the same load.</h1>
        <p className="lb-sub">
          Drivers see the rate, the miles, the deadhead and the broker before they commit.
          Shippers see exactly where their freight is. Nobody calls anybody to ask.
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 2, fontSize: '.7rem', color: '#66718a' }}>
        Every mutation is row-level-secured in Postgres
      </div>
    </div>
  );
}
