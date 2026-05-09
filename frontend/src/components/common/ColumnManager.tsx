import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Eye, EyeOff, X } from 'lucide-react';

export interface Column {
  id: string;
  label: string;
}

interface ColumnManagerProps {
  columns: Column[];
  visibleColumns: string[];
  onToggle: (id: string) => void;
  onReorder: (newOrder: Column[]) => void;
  onClose: () => void;
}

const ColumnManager: React.FC<ColumnManagerProps> = ({
  columns,
  visibleColumns,
  onToggle,
  onReorder,
  onClose
}) => {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(columns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onReorder(items);
  };

  return (
    <div className="glass-card animate-scale-in" style={{
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: '12px',
      zIndex: 1000,
      width: '280px',
      padding: '20px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
      border: '1px solid var(--border)',
      background: 'rgba(23, 27, 44, 0.95)',
      backdropFilter: 'blur(12px)',
      borderRadius: '20px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ 
          fontSize: '0.85rem', 
          fontWeight: 800, 
          color: 'var(--text-primary)', 
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Настройка колонок
        </div>
        <button 
          onClick={onClose}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--text-muted)', 
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '8px'
          }}
        >
          <X size={18} />
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="columns">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef}
              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              {columns.map((col, index) => (
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
                        padding: '10px 12px',
                        background: snapshot.isDragging ? 'var(--bg-tertiary)' : 'transparent',
                        borderRadius: '12px',
                        border: snapshot.isDragging ? '1px solid var(--accent)' : '1px solid transparent',
                        transition: 'background 0.2s, border 0.2s',
                        cursor: 'default'
                      }}
                      className="column-item-hover"
                    >
                      <div {...provided.dragHandleProps} style={{ color: 'var(--text-muted)', cursor: 'grab', display: 'flex' }}>
                        <GripVertical size={16} />
                      </div>
                      
                      <div 
                        onClick={() => onToggle(col.id)}
                        style={{ 
                          flex: 1, 
                          fontSize: '0.9rem', 
                          fontWeight: 500, 
                          color: visibleColumns.includes(col.id) ? 'var(--text-primary)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        {col.label}
                      </div>

                      <button
                        onClick={() => onToggle(col.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: visibleColumns.includes(col.id) ? 'var(--accent)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px'
                        }}
                      >
                        {visibleColumns.includes(col.id) ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div style={{ 
        marginTop: '16px', 
        paddingTop: '12px', 
        borderTop: '1px solid var(--border)',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        Перетащите для изменения порядка
      </div>
    </div>
  );
};

export default ColumnManager;
