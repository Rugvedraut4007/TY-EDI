import { useState } from "react";
import "../styles/PharmacistDashboard.css";

function PharmacistDashboard() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="pharmacist-page">

      {/* Top Bar */}
      <header className="pharmacist-header">
        <button
          className="menu-button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>

        <div className="header-logo">
          <span>💊</span>
          <h1>MedCentral</h1>
        </div>

        <div className="pharmacist-profile">
          <div className="profile-avatar">P</div>
          <span>Pharmacist</span>
        </div>
      </header>


      {/* Side Menu Overlay */}
      {menuOpen && (
        <div
          className="menu-overlay"
          onClick={() => setMenuOpen(false)}
        ></div>
      )}


      {/* Side Menu */}
      <aside className={`side-menu ${menuOpen ? "open" : ""}`}>

        <div className="side-menu-header">
          <div className="side-menu-logo">
            <span>💊</span>
            <h2>MedCentral</h2>
          </div>

          <button
            className="close-menu"
            onClick={() => setMenuOpen(false)}
          >
            ×
          </button>
        </div>


        <nav className="side-menu-nav">

          <button className="menu-item active">
            <span>⌂</span>
            <span>Home</span>
          </button>

          <button className="menu-item">
            <span>💊</span>
            <span>Medicines</span>
          </button>

          <button className="menu-item">
            <span>📦</span>
            <span>Inventory</span>
          </button>

          <button className="menu-item">
            <span>🧾</span>
            <span>Billing</span>
          </button>

          <button className="menu-item">
            <span>📋</span>
            <span>Transactions</span>
          </button>

          <div className="menu-divider"></div>

          <button className="menu-item">
            <span>👤</span>
            <span>Profile</span>
          </button>

          <button className="menu-item logout-item">
            <span>↪</span>
            <span>Logout</span>
          </button>

        </nav>

      </aside>


      {/* Main Dashboard */}
      <main className="pharmacist-main">

        <section className="welcome-section">
          <p className="welcome-small">PHARMACIST DASHBOARD</p>

          <h2>Welcome back!</h2>

          <p>
            Manage your pharmacy, inventory and billing from one place.
          </p>
        </section>


        {/* Dashboard Cards */}
        <section className="dashboard-cards">

          <div className="dashboard-card">
            <div className="card-icon">💊</div>

            <div>
              <p>Total Medicines</p>
              <h3>124</h3>
            </div>
          </div>


          <div className="dashboard-card">
            <div className="card-icon">📦</div>

            <div>
              <p>Inventory Items</p>
              <h3>86</h3>
            </div>
          </div>


          <div className="dashboard-card">
            <div className="card-icon">🧾</div>

            <div>
              <p>Today's Sales</p>
              <h3>₹12,450</h3>
            </div>
          </div>

        </section>


        {/* Quick Actions */}
        <section className="dashboard-section">

          <div className="section-heading">
            <h3>Quick Actions</h3>
            <p>Frequently used pharmacy actions</p>
          </div>

          <div className="quick-actions">

            <button className="quick-action">
              <span>💊</span>
              <div>
                <strong>Manage Medicines</strong>
                <small>View available medicines</small>
              </div>
            </button>

            <button className="quick-action">
              <span>📦</span>
              <div>
                <strong>Manage Inventory</strong>
                <small>Update your pharmacy stock</small>
              </div>
            </button>

            <button className="quick-action">
              <span>🧾</span>
              <div>
                <strong>Create Bill</strong>
                <small>Create a new customer bill</small>
              </div>
            </button>

          </div>

        </section>


        {/* Recent Transactions */}
        <section className="dashboard-section">

          <div className="section-heading">
            <h3>Recent Transactions</h3>
            <p>Your latest pharmacy transactions</p>
          </div>

          <div className="transactions-card">

            <div className="transaction-row transaction-header">
              <span>Bill ID</span>
              <span>Customer</span>
              <span>Amount</span>
              <span>Date</span>
            </div>

            <div className="transaction-row">
              <span>#1024</span>
              <span>Customer</span>
              <span>₹450</span>
              <span>Today</span>
            </div>

            <div className="transaction-row">
              <span>#1023</span>
              <span>Customer</span>
              <span>₹720</span>
              <span>Today</span>
            </div>

            <div className="transaction-row">
              <span>#1022</span>
              <span>Customer</span>
              <span>₹310</span>
              <span>Yesterday</span>
            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

export default PharmacistDashboard;