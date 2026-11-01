import React from 'react';

export const Card = ({ children, padding = 'md', style, ...props }) => (
  <div
    style={{
      backgroundColor: 'var(--color-surface)',
      borderRadius: 'var(--radius-lg)',
      padding: `var(--spacing-${padding})`,
      boxShadow: 'var(--shadow-md)',
      border: '1px solid var(--color-border)',
      ...style
    }}
    {...props}
  >
    {children}
  </div>
);

export const Button = ({ children, variant = 'primary', size = 'md', style, ...props }) => {
  const bg = variant === 'primary' ? 'var(--color-primary)' : 
             variant === 'secondary' ? 'var(--color-secondary)' : 
             variant === 'danger' ? 'var(--color-error)' : 'var(--color-surface)';
  const color = variant === 'ghost' ? 'var(--color-text)' : '#ffffff';
  
  return (
    <button
      style={{
        backgroundColor: bg,
        color: color,
        border: variant === 'ghost' ? '1px solid var(--color-border)' : 'none',
        borderRadius: 'var(--radius-md)',
        padding: size === 'sm' ? '8px 16px' : '12px 24px',
        fontSize: size === 'sm' ? '14px' : '16px',
        fontWeight: '600',
        cursor: 'pointer',
        minWidth: 'var(--touch-target-min)',
        minHeight: 'var(--touch-target-min)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.2s ease, transform 0.1s active',
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
};

export const IconButton = ({ children, ...props }) => (
  <Button
    style={{
      padding: '8px',
      borderRadius: 'var(--radius-full)',
      width: 'var(--touch-target-min)',
      height: 'var(--touch-target-min)',
      minWidth: 'var(--touch-target-min)',
    }}
    {...props}
  >
    {children}
  </Button>
);

export const Toggle = ({ checked, onChange, label }) => (
  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 'var(--spacing-sm)' }}>
    <div style={{ position: 'relative' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <div style={{
        width: '50px',
        height: '26px',
        backgroundColor: checked ? 'var(--color-success)' : 'var(--color-border)',
        borderRadius: '13px',
        transition: '0.3s',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: '3px',
          left: checked ? '27px' : '3px',
          width: '20px',
          height: '20px',
          backgroundColor: 'white',
          borderRadius: '50%',
          transition: '0.3s'
        }} />
      </div>
    </div>
    {label && <span>{label}</span>}
  </label>
);

export const StatusBadge = ({ status, children }) => {
  const colors = {
    healthy: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
    info: 'var(--color-info)',
  };
  const color = colors[status] || 'var(--color-textSecondary)';
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 12px',
      borderRadius: 'var(--radius-full)',
      backgroundColor: `${color}22`,
      color: color,
      fontSize: '12px',
      fontWeight: 'bold',
      textTransform: 'uppercase'
    }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
      {children}
    </span>
  );
};

export const SectionHeader = ({ title, action }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--spacing-md)',
    marginTop: 'var(--spacing-lg)'
  }}>
    <h2 style={{ margin: 0, fontSize: '20px' }}>{title}</h2>
    {action}
  </div>
);

export const ProgressBar = ({ value, color = 'var(--color-primary)', height = '8px' }) => (
  <div style={{
    width: '100%',
    height: height,
    backgroundColor: 'var(--color-border)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden'
  }}>
    <div style={{
      width: `${Math.min(100, Math.max(0, value))}%`,
      height: '100%',
      backgroundColor: color,
      transition: 'width 0.5s ease-out'
    }} />
  </div>
);

// A section that expands/collapses when its header is clicked.
export const Collapsible = ({ title, summary, defaultOpen = false, children, style }) => {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-sm) 0',
          background: 'none',
          border: 'none',
          color: 'var(--color-text)',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          minHeight: 'var(--touch-target-min)',
          textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {summary && (
            <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-textSecondary)' }}>
              {summary}
            </span>
          )}
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
              color: 'var(--color-textSecondary)',
            }}
          >
            ▾
          </span>
        </span>
      </button>
      {open && <div style={{ paddingTop: 'var(--spacing-sm)' }}>{children}</div>}
    </div>
  );
};
