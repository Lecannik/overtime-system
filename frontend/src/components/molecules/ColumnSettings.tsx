import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, Eye, EyeOff } from 'lucide-react';

interface Column {
  id: string;
  label: string;
}

interface ColumnSettingsProps {
  columns: Column[];
  visibleColumnIds: string[];
  onToggle: (id: string) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
}

const ColumnSettings: React.FC<ColumnSettingsProps> = ({
  columns,
  visibleColumnIds,
  onToggle,
  onReorder
}) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    onReorder(result.source.index, result.destination.index);
  };

  if (!enabled) return null;

  return (
    <div className="glass-card animate-scale-in" style={{
      position: 'absolute',
      top: 'calc(100% + 12px)',
      right: 0,
      zIndex: 1000,
      width: '260px',
      padding: '16px',
      boxShadow: 'var(--card-shadow)',
      border: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      backdropFilter: 'blur(20px)',
      borderRadius: '16px',
      userSelect: 'none'
    }}>
      <div style={{ 
        fontSize: '0.75rem', 
        fontWeight: 900, 
        color: 'var(--text-primary)', 
        marginBottom: '12px', 
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        paddingLeft: '4px'
      }}>
        Настройка колонок
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="columns-list">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef}
              style={{ minHeight: '10px' }}
            >
              {columns.map((col, index) => {
                const isVisible = visibleColumnIds.includes(col.id);
                return (
                  <Draggable key={col.id} draggableId={col.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={{
                          ...provided.draggableProps.style,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 14px',
                          marginBottom: '8px',
                          background: snapshot.isDragging 
                            ? 'var(--bg-tertiary)' 
                            : 'var(--bg-secondary)',
                          borderRadius: '14px',
                          border: '1px solid',
                          borderColor: snapshot.isDragging 
                            ? 'var(--accent)' 
                            : 'var(--border)',
                          boxShadow: snapshot.isDragging 
                            ? '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px var(--accent)' 
                            : 'none',
                          transform: snapshot.isDragging 
                            ? `${provided.draggableProps.style?.transform} scale(1.02)` 
                            : provided.draggableProps.style?.transform,
                          transition: snapshot.isDragging 
                            ? 'background 0.2s, border 0.2s, box-shadow 0.2s' 
                            : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          zIndex: snapshot.isDragging ? 1001 : 1
                        }}
                      >
                        <div 
                          {...provided.dragHandleProps} 
                          style={{ 
                            color: snapshot.isDragging ? 'var(--accent)' : 'var(--text-muted)', 
                            cursor: 'grab', 
                            display: 'flex', 
                            alignItems: 'center',
                            padding: '4px',
                            transition: 'color 0.2s'
                          }}
                        >
                          <GripVertical size={16} />
                        </div>
                        
                        <div 
                          onClick={() => onToggle(col.id)}
                          style={{ 
                            flex: 1, 
                            fontSize: '0.9rem', 
                            fontWeight: isVisible ? 700 : 500,
                            color: isVisible ? 'var(--text-primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            transition: 'color 0.2s'
                          }}
                        >
                          {col.label}
                        </div>

                        <div 
                          onClick={() => onToggle(col.id)}
                          style={{ 
                            cursor: 'pointer', 
                            color: isVisible ? 'var(--accent)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: isVisible ? 1 : 0.4,
                            transition: 'all 0.2s',
                            transform: isVisible ? 'scale(1)' : 'scale(0.9)'
                          }}
                        >
                          {isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div style={{ 
        marginTop: '12px', 
        paddingTop: '10px', 
        borderTop: '1px solid var(--border)',
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        opacity: 0.8
      }}>
        Перетащите для изменения порядка
      </div>
    </div>
  );
};

export default ColumnSettings;
