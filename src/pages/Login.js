import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./../styles/Auth.css";

import eyeIcon from "../assets/eye.png";
import eyeOffIcon from "../assets/eye-off.jpg";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setEmailError("");
    setPasswordError("");

    let hasError = false;

    // Email validation
    if (!email.trim()) {
      setEmailError("Please enter your email address.");
      hasError = true;
    }

    // Password validation
    if (!password) {
      setPasswordError("Please enter your password.");
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Invalid email or password.");
        setLoading(false);
        return;
      }

      console.log("Logged in user:", data.user);

      // Redirect based on user role
      if (data.user.role === "user") {
        navigate("/user-dashboard");
      } else if (data.user.role === "pharmacist") {
        navigate("/pharmacist-dashboard");
      } else if (data.user.role === "manufacturer") {
        navigate("/manufacturer-dashboard");
      }
    } catch (error) {
      console.error(error);

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setError("Password reset will be available soon.");
  };

  return (
    <div className="auth-page">

      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">💊</div>
          <h1>MedCentral</h1>
        </div>

        {/* Heading */}
        <div className="auth-heading">
          <h2>Welcome back</h2>
          <p>Login to your MedCentral account</p>
        </div>

        {/* General Error */}
        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin}>

          {/* Email */}
          <div className="form-group">

            <label htmlFor="email">
              Email Address
            </label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              className={emailError ? "input-error" : ""}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError("");
                setError("");
              }}
            />

            {emailError && (
              <span className="field-error">
                {emailError}
              </span>
            )}

          </div>

          {/* Password */}
          <div className="form-group">

            <label htmlFor="password">
              Password
            </label>

            <div className="password-wrapper">

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                className={passwordError ? "input-error" : ""}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                  setError("");
                }}
              />

              {/* Show / Hide Password */}
              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                <img
                  src={
                    showPassword
                      ? eyeOffIcon
                      : eyeIcon
                  }
                  alt=""
                />
              </button>

            </div>

            {passwordError && (
              <span className="field-error">
                {passwordError}
              </span>
            )}

            {/* Forgot Password */}
            <button
              type="button"
              className="forgot-password"
              onClick={handleForgotPassword}
            >
              Forgot password?
            </button>

          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>

        </form>

        {/* Register */}
        <div className="register-section">

          <span>
            Don't have an account?
          </span>

          <button
            type="button"
            onClick={() => navigate("/register")}
          >
            Create an account
          </button>

        </div>

        {/* Footer */}
        <p className="auth-footer">
          © 2026 MedCentral. All rights reserved.
        </p>

      </div>

    </div>
  );
}

export default Login;