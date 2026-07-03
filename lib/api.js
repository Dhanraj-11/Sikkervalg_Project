export async function api(path, body, token) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      // Stale/invalid token — clear it and bounce to login instead of
      // letting every page independently handle (or miss) this case.
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}
