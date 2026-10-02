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
    const trend = calculateTrend(value, prevValue);

    const getTrendIcon = () => {
        switch (trend.trend) {
            case 'up':
                return <TrendingUp className="h-3.5 w-3.5" />;
            case 'down':
                return <TrendingDown className="h-3.5 w-3.5" />;
            default:
                return <Minus className="h-3.5 w-3.5" />;
        }
    };

    const getTrendColor = () => {
        switch (trend.trend) {
            case 'up':
                return 'text-green-600';
            case 'down':
                return 'text-red-600';
            default:
                return 'text-gray-500';
        }
    };

    return (
        <div className={`${bgColor} px-2.5 py-1.5 rounded-lg shadow-sm relative overflow-hidden mb-1.5 border border-gray-100`}>
            {Icon && (
                <Icon className="absolute right-1 bottom-1 h-7 w-7 text-gray-200 opacity-30"/>
            )}
            <div className="relative z-10">
                <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold text-gray-700 truncate">{title}</h3>

            {prevValue !== undefined && (
                <div className={`flex items-center space-x-1 ${getTrendColor()} shrink-0`}>
                    {getTrendIcon()}
                    <span className="text-[10px] font-medium">{trend.percentage.toFixed(1)}%</span>
                </div>
            )}
        </div>

        <p className="text-sm font-bold leading-tight text-gray-800 truncate">
            {formatNumber(value || 0)}
        </p>

        {prevValue !== undefined && trend.trend !== 'neutral' && (
            <div className={`text-[10px] mt-0.5 ${getTrendColor()}`}>
                {trend.trend === 'up' ? '+' : ''}
                {formatNumber(trend.change)}
            </div>
        )}
    </div>
</div>
    );
};

export default CardItem;