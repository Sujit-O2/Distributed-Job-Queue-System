import React from "react";
import { Activity } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an extreme sub-component crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-[#f04f6e]/10 border border-[#f04f6e]/20 rounded-2xl w-full text-center">
          <Activity className="text-[#f04f6e] w-8 h-8 mb-3" />
          <h4 className="text-[#f5f7ff] font-['Space_Grotesk'] text-lg font-bold">Component Crash Prevented</h4>
          <p className="text-[#f04f6e]/80 text-sm mt-1 max-w-sm">
            This module encountered malformed active data and was safely isolated to prevent a complete application freeze.
          </p>
          {this.state.error && (
            <pre className="mt-4 p-3 bg-black/40 rounded-lg text-xs font-mono text-[#f04f6e]/60 text-left w-full overflow-x-auto border border-white/5">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
