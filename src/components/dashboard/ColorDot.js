import React from 'react';

const DOT_COLORS = {
    blue:   '#3B82F6',
    orange: '#F97316',
    green:  '#22C55E',
    red:    '#EF4444',
    pink:   '#F9A8D4',
    violet: '#8B5CF6',
    lime:   '#84CC16',
    yellow: '#EAB308',
    dark:   '#1F2937',
    sky:    '#06B6D4',
};

const ColorDot = ({ color = 'blue' }) => (
    <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: DOT_COLORS[color] || '#94A3B8' }}
    />
);

export default ColorDot;