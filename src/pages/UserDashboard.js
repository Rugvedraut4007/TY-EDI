import "./../styles/UserDashboard.css";

function UserDashboard() {
  return (
    <div className="user-dashboard">

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <span>💊</span>
          <h2>MedCentral</h2>
        </div>

        <nav>
          <button className="nav-item active">
            🏠 Dashboard
          </button>

          <button className="nav-item">
            🔍 Search Medicines
          </button>

          <button className="nav-item">
            ⚖️ Compare Prices
          </button>

          <button className="nav-item">
            🏭 Manufacturers
          </button>
        </nav>

        <button className="logout-button">
          ↪ Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">

        {/* Header */}
        <header className="top-header">
          <div>
            <p className="welcome-text">Welcome back,</p>
            <h1>Medicine Dashboard</h1>
          </div>

          <div className="profile">
            <div className="profile-icon">TU</div>
            <div>
              <strong>Test User</strong>
              <p>Normal User</p>
            </div>
          </div>
        </header>

        {/* Search */}
        <section className="search-section">
          <h2>Find Your Medicine</h2>
          <p>
            Search medicines, check prices and compare manufacturers.
          </p>

          <div className="search-box">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search medicine by name..."
            />
            <button>Search</button>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="section">
          <h2>Quick Actions</h2>

          <div className="action-grid">

            <div className="action-card">
              <div className="action-icon">🔍</div>
              <h3>Search Medicines</h3>
              <p>Find medicines and view their details.</p>
              <button>Search →</button>
            </div>

            <div className="action-card">
              <div className="action-icon">💰</div>
              <h3>Compare Prices</h3>
              <p>Compare medicine prices from manufacturers.</p>
              <button>Compare →</button>
            </div>

            <div className="action-card">
              <div className="action-icon">🏭</div>
              <h3>Manufacturers</h3>
              <p>Explore manufacturers and their medicines.</p>
              <button>View →</button>
            </div>

          </div>
        </section>

        {/* Popular Medicines */}
        <section className="section">
          <div className="section-header">
            <div>
              <h2>Popular Medicines</h2>
              <p>Frequently searched medicines</p>
            </div>

            <button className="view-all">View All →</button>
          </div>

          <div className="medicine-grid">

            <div className="medicine-card">
              <div className="medicine-image">💊</div>
              <div>
                <h3>Paracetamol</h3>
                <p>500 mg • Tablet</p>
                <strong>₹25.00</strong>
              </div>
            </div>

            <div className="medicine-card">
              <div className="medicine-image">💊</div>
              <div>
                <h3>Amoxicillin</h3>
                <p>500 mg • Capsule</p>
                <strong>₹85.00</strong>
              </div>
            </div>

            <div className="medicine-card">
              <div className="medicine-image">💊</div>
              <div>
                <h3>Azithromycin</h3>
                <p>500 mg • Tablet</p>
                <strong>₹60.00</strong>
              </div>
            </div>

            <div className="medicine-card">
              <div className="medicine-image">💊</div>
              <div>
                <h3>Ibuprofen</h3>
                <p>400 mg • Tablet</p>
                <strong>₹35.00</strong>
              </div>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}

export default UserDashboard;