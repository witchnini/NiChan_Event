import { useLocation } from "react-router-dom";

/**
 * Returns a function that appends the current role/organizer query params to any path.
 * Use this in public pages (Index, Portfolio, PortfolioDetail, etc.) so navigation
 * links preserve the active role (admin / organizer / customer).
 */
export const useAppendRole = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const roleParam = params.get("role");
  const organizerParam = params.get("organizer");

  // Customer role can also be inferred from the /dashboard path
  const isCustomerPath = location.pathname.startsWith("/dashboard");
  const effectiveRole = isCustomerPath ? "customer" : roleParam;

  return (path: string): string => {
    if (!effectiveRole) return path;
    // Never append to portal routes — they manage their own params
    if (
      path.startsWith("/dashboard") ||
      path.startsWith("/admin") ||
      path.startsWith("/ban-to-chuc")
    )
      return path;

    const separator = path.includes("?") ? "&" : "?";
    const extra = organizerParam ? `&organizer=${organizerParam}` : "";
    return `${path}${separator}role=${effectiveRole}${extra}`;
  };
};
