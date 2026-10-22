import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        const { data } = await api.get("/auth/me");
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
      } catch (err) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const persistSession = (data) => {
    const { token, ...userData } = data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    persistSession(data);
    return data;
  };

  const register = async (name, email, password, otp) => {
    const { data } = await api.post("/auth/register", {
      name,
      email,
      password,
      otp,
    });
    persistSession(data);
    return data;
  };

  const googleLogin = async (credential) => {
    const { data } = await api.post("/auth/google", { credential });
    persistSession(data);
    return data;
  };

  const loginWithOtp = async (email, otp) => {
    const { data } = await api.post("/auth/login-otp", { email, otp });
    persistSession(data);
    return data;
  };

  const sendOtp = async (email, purpose = "reset_password", name = "") => {
    const { data } = await api.post("/auth/send-otp", { email, purpose, name });
    return data;
  };

  const verifyOtp = async (email, otp, purpose = "reset_password") => {
    const { data } = await api.post("/auth/verify-otp", {
      email,
      otp,
      purpose,
    });
    return data;
  };

  const resetPassword = async (email, otp, newPassword) => {
    const { data } = await api.post("/auth/reset-password", {
      email,
      otp,
      newPassword,
    });
    return data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        googleLogin,
        loginWithOtp,
        sendOtp,
        verifyOtp,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
