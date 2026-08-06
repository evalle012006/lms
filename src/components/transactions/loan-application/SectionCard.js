const SectionCard = ({ icon: Icon, title, subtitle, children, className = '' }) => (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            {Icon && <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            <div>
                <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
        </div>
        <div className="p-5">{children}</div>
    </div>
);

export default SectionCard;