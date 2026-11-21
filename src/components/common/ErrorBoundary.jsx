import React from 'react';
import RescueScreen from './RescueScreen.jsx';
import { logError } from '../../lib/errorLog.js';
import { tx } from '../../lib/i18n.js';

/**
 * Error barrier (lot 5.1): at the root of both interfaces, and around each
 * page — a screen that crashes shows the rescue screen instead of a blank
 * app; around a page, the navigation stays usable (`key` = the page: going
 * to another page tries again).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, where: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const component = /^\s*at (\w+)/.exec(info?.componentStack || '')?.[1];
    const where = this.props.where || component || tx('écran');
    logError(error, where);
    this.setState({ where });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <RescueScreen error={this.state.error} where={this.state.where || this.props.where} full={!this.props.page} />;
  }
}
