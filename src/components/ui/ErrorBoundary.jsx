import React from 'react';

/**
 * Lightweight ErrorBoundary component that isolates crashes in sub-trees
 * (e.g., realtime notification widgets or auxiliary cards) without breaking
 * the entire application navigation or layout.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('ErrorBoundary caught an unhandled component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}
