import React, { useState } from 'react';
import '../styles.css';

const AnimatedList = ({ items, onItemSelect, showGradients, enableArrowNavigation, displayScrollbar }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleItemClick = (index, item) => {
    setSelectedIndex(index);
    onItemSelect(item);
  };

  const handleKeyDown = (e) => {
    if (!enableArrowNavigation) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onItemSelect(items[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  };

  return (
    <div
      className={`animated-list ${showGradients ? 'animated-list--soft' : ''}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="menu"
      aria-label="Programs menu"
    >
      <ul style={{ overflowY: displayScrollbar ? 'auto' : 'hidden' }}>
        {items.map((item, index) => (
          <button
            type="button"
            key={index}
            className={`list-item ${selectedIndex === index ? 'selected' : ''}`}
            onClick={() => handleItemClick(index, item)}
            role="menuitem"
          >
            <span className="list-item-label">{item}</span>
            <span className="list-item-arrow">→</span>
          </button>
        ))}
      </ul>
    </div>
  );
};

export default AnimatedList;
