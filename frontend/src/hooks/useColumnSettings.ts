import { useState, useEffect } from 'react';

export interface Column {
  id: string;
  label: string;
}

export const useColumnSettings = (storageKey: string, initialColumns: Column[]) => {
  // Весь список колонок в текущем порядке
  const [columns, setColumns] = useState<Column[]>(() => {
    const savedOrder = localStorage.getItem(`${storageKey}_order`);
    if (savedOrder) {
      const orderIds = JSON.parse(savedOrder) as string[];
      // Создаем новый список на основе сохраненного порядка
      const reordered = orderIds
        .map(id => initialColumns.find(col => col.id === id))
        .filter((col): col is Column => !!col);
      
      // Добавляем новые колонки, которых нет в сохраненном порядке (если они появились в коде)
      const newCols = initialColumns.filter(col => !orderIds.includes(col.id));
      return [...reordered, ...newCols];
    }
    return initialColumns;
  });

  // Список только видимых колонок (ID)
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => {
    const savedVisibility = localStorage.getItem(`${storageKey}_visibility`);
    if (savedVisibility) {
      return JSON.parse(savedVisibility);
    }
    // По умолчанию показываем первые 5 колонок или все, если их меньше
    return initialColumns.slice(0, 6).map(c => c.id);
  });

  const toggleColumn = (id: string) => {
    setVisibleColumnIds(prev => {
      const next = prev.includes(id) 
        ? prev.filter(c => c !== id) 
        : [...prev, id];
      localStorage.setItem(`${storageKey}_visibility`, JSON.stringify(next));
      return next;
    });
  };

  const isVisible = (id: string) => visibleColumnIds.includes(id);

  const reorderColumns = (startIndex: number, endIndex: number) => {
    const result = Array.from(columns);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    setColumns(result);
    localStorage.setItem(`${storageKey}_order`, JSON.stringify(result.map(c => c.id)));
  };

  // Возвращаем отфильтрованный и упорядоченный список для рендеринга таблицы
  const activeColumns = columns.filter(col => visibleColumnIds.includes(col.id));

  return {
    columns,           // Все колонки (с текущим порядком)
    activeColumns,     // Только видимые колонки (в текущем порядке)
    visibleColumnIds,
    toggleColumn,
    isVisible,
    reorderColumns
  };
};
