import React, { useMemo, useState } from "react";
import axios from "axios";
import locationData from "./locationData";

const Profile = ({ onCreated }) => {
  const [name, setName] = useState("");
  const [stateName, setStateName] = useState("");
  const [district, setDistrict] = useState("");
  const [crop, setCrop] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setIsLoading(true);
      const res = await axios.post("http://127.0.0.1:8000/create_profile", {
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        district: district.trim() || null,
        crop: crop.trim() || null,
        state: stateName || null,
      });
      const { user_id } = res.data || {};
      if (!user_id) throw new Error("Invalid server response");
      localStorage.setItem("user_id", user_id);
      localStorage.setItem("user_name", name.trim());
      onCreated?.(user_id);
    } catch (err) {
      setError("Failed to create profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const availableStates = useMemo(() => Object.keys(locationData), []);
  const availableDistricts = useMemo(
    () => (stateName ? locationData[stateName] || [] : []),
    [stateName]
  );

  const handleStateChange = (e) => {
    const value = e.target.value;
    setStateName(value);
    setDistrict("");
  };

  return (
    <div className="upload-section">
      <h2 style={{ marginBottom: 12 }}>Create your profile</h2>
      {error && <div className="error">{error}</div>}
      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: 12, maxWidth: 420 }}
      >
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="question-input"
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="question-input"
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="question-input"
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        />
        <select
          value={stateName}
          onChange={handleStateChange}
          className="question-input"
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        >
          <option value="">Select State</option>
          {availableStates.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="question-input"
          disabled={!stateName}
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        >
          <option value="">
            {stateName ? "Select District" : "Select a state first"}
          </option>
          {availableDistricts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Primary Crop"
          value={crop}
          onChange={(e) => setCrop(e.target.value)}
          className="question-input"
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        />
        <button type="submit" className="upload-button" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Profile"}
        </button>
      </form>
    </div>
  );
};

export default Profile;
