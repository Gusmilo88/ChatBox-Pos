import { ReactNode } from 'react'

interface TabsProps {
  tabs: { id: string; label: string; icon?: ReactNode }[]
  activeTab: string
  onTabChange: (tabId: string) => void
  children: ReactNode
}

export function Tabs({ tabs, activeTab, onTabChange, children }: TabsProps) {
  return (
    <div style={{ width: '100%' }}>
      {/* Tab Headers - Premium Design */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        backgroundColor: '#f9fafb',
        padding: '4px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: '12px 20px',
                fontSize: '15px',
                fontWeight: isActive ? '600' : '500',
                color: isActive ? '#111827' : '#6b7280',
                background: isActive 
                  ? 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)'
                  : 'transparent',
                border: isActive ? '1px solid #e5e7eb' : '1px solid transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flex: 1,
                justifyContent: 'center',
                boxShadow: isActive ? '0 2px 4px rgba(0, 0, 0, 0.05)' : 'none',
                minWidth: '120px'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#3b82f6'
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#6b7280'
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <span style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? '#3b82f6' : 'inherit'
              }}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div style={{
        width: '100%',
        animation: 'fadeIn 0.3s ease'
      }}>
        {children}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

