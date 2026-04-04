import React from 'react';
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';

export const formatNumber = (num) => {
    if (num === undefined || num === null) return 'N/A';
    if (typeof num === 'number') return num.toLocaleString('en-US');
    return num;
};

const calculateTrend = (current, previous) => {
    const currentValue  = current  || 0;
    const previousValue = previous || 0;
    if (previousValue === 0) {
        if (currentValue === 0) return { change: 0, trend: 'neutral', percentage: 0 };
        return { change: currentValue, trend: currentValue > 0 ? 'up' : 'down', percentage: 100 };
    }
    const change     = currentValue - previousValue;
    const percentage = (change / Math.abs(previousValue)) * 100;
    const trend      = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    return { change, trend, percentage: Math.abs(percentage) };
};

const CardItem = ({ title, value, prevValue, Icon, bgColor = 'bg-blue-50' }) => {
    const IconComponent = Icon || HelpCircle;
    const trend = calculateTrend(value, prevValue);

    const getTrendIcon = () => {
        switch (trend.trend) {
            case 'up':   return <TrendingUp  className="h-4 w-4" />;
            case 'down': return <TrendingDown className="h-4 w-4" />;
            default:     return <Minus        className="h-4 w-4" />;
        }
    };

    const getTrendColor = () => {
        switch (trend.trend) {
            case 'up':   return 'text-green-600';
            case 'down': return 'text-red-600';
            default:     return 'text-gray-500';
        }
    };

    return (
        <div className={`${bgColor} p-3 rounded-lg shadow-sm relative overflow-hidden mb-2 border border-gray-100`}>
            <IconComponent className="absolute right-1 bottom-1 h-10 w-10 text-gray-200 opacity-30" />
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-gray-700 truncate">{title}</h3>
                    {prevValue !== undefined && (
                        <div className={`flex items-center space-x-1 ${getTrendColor()} shrink-0`}>
                            {getTrendIcon()}
                            <span className="text-xs font-medium">{trend.percentage.toFixed(1)}%</span>
                        </div>
                    )}
                </div>
                <p className="text-base font-bold text-gray-800 truncate">{formatNumber(value || 0)}</p>
                {prevValue !== undefined && trend.trend !== 'neutral' && (
                    <div className={`text-xs mt-1 ${getTrendColor()}`}>
                        {trend.trend === 'up' ? '+' : ''}{formatNumber(trend.change)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CardItem;