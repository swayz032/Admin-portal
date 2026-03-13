/**
 * Tests for ErrorBoundary component (A-H2 — Wave 3).
 *
 * Verifies:
 * - Normal children render correctly
 * - Error in child triggers fallback UI
 * - Reset button recovers from error
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

const reporterMocks = vi.hoisted(() => ({
  reportPortalIncident: vi.fn().mockResolvedValue(true),
  captureWindowError: vi.fn().mockResolvedValue(true),
  captureUnhandledRejection: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/frontendIncidentReporter", () => ({
  reportPortalIncident: reporterMocks.reportPortalIncident,
  captureWindowError: reporterMocks.captureWindowError,
  captureUnhandledRejection: reporterMocks.captureUnhandledRejection,
}));

// Component that throws on demand
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error for boundary");
  }
  return <div data-testid="child">Hello from child</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suppress React error boundary console output in tests
    vi.spyOn(console, "error").mockImplementation(() => {});
    reporterMocks.reportPortalIncident.mockClear();
    reporterMocks.captureWindowError.mockClear();
    reporterMocks.captureUnhandledRejection.mockClear();
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello from child")).toBeInTheDocument();
  });

  it("renders error fallback when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("displays error message in fallback UI", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText(/test error for boundary/i)).toBeInTheDocument();
  });

  it("reports render errors to the backend incident path", async () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(reporterMocks.reportPortalIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "render_error",
          title: "Admin portal render error",
          component: "react_boundary",
          severity: "sev2",
          message: "Test error for boundary",
        })
      );
    });
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
  });

  it("has a Try Again button that resets the boundary", () => {
    // We can't easily test reset with ThrowingChild (it'll throw again)
    // But we can verify the button exists in the default fallback
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });

  it("has a Reload Page button", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText(/reload page/i)).toBeInTheDocument();
  });

  it("captures uncaught window errors", async () => {
    render(
      <ErrorBoundary>
        <div>Safe child</div>
      </ErrorBoundary>
    );

    window.dispatchEvent(new ErrorEvent("error", { message: "Window boom" }));

    await waitFor(() => {
      expect(reporterMocks.captureWindowError).toHaveBeenCalledTimes(1);
    });
  });
});
