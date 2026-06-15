import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    // Có thể tích hợp log lỗi lên server tại đây trong tương lai
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconContainer}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="url(#grad)" />
                <path d="M12 8V13M12 16H12.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ff4b2b" />
                    <stop offset="100%" stopColor="#ff416c" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 style={styles.title}>Đã xảy ra sự cố</h1>
            <p style={styles.subtitle}>
              Ứng dụng vừa gặp lỗi không mong muốn. Đừng lo lắng, dữ liệu trò chuyện của bạn vẫn an toàn.
            </p>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Chi tiết lỗi kỹ thuật</summary>
                <pre style={styles.pre}>
                  {this.state.error.toString()}
                  {"\n"}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button style={styles.button} onClick={this.handleReset}>
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: '#0a0a0c',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    color: '#ffffff',
    padding: '20px',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '40px 30px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
  },
  iconContainer: {
    marginBottom: '24px',
    display: 'inline-flex',
    padding: '16px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 75, 43, 0.1)',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '12px',
    letterSpacing: '-0.5px',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: '15px',
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: '1.6',
    marginBottom: '30px',
  },
  button: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    color: 'white',
    padding: '14px 28px',
    fontSize: '15px',
    fontWeight: '600',
    borderRadius: '12px',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
  },
  details: {
    textAlign: 'left',
    margin: '20px 0',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  summary: {
    padding: '10px 15px',
    fontSize: '13px',
    cursor: 'pointer',
    color: 'rgba(255, 255, 255, 0.4)',
    userSelect: 'none',
  },
  pre: {
    padding: '0 15px 15px 15px',
    margin: '0',
    fontSize: '12px',
    color: '#ff6b6b',
    overflowX: 'auto',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  }
};

export default ErrorBoundary;
