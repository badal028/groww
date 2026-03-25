import React from "react";
import { Navigate } from "react-router-dom";

/**
 * Lovable placeholder removed.
 * If this route is ever hit, send the user to the real app.
 */
export default function Index() {
  return <Navigate to="/stocks" replace />;
}
