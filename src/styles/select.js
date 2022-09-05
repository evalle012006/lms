export const styles = {
    control: (base) => ({
        ...base,
        border: 0,
        padding: 0,
        margin: 0,
        boxShadow: 'none',
        position: 'relative',
        minHeight: '20px',
        height: '30px'
    }),
    option: (base) => ({
        ...base,
        cursor: 'pointer'
    }),
    placeholder: (base) => ({
        ...base,
        paddingLeft: '6px',
        fontSize: '14px',
        fontWeight: '500',
        fontFace: 'proxima-regular',
        color: 'rgb(107 114 128)',
        opacity: '.8'
    }),
    input: (base) => ({
        ...base,
        paddingLeft: '6px',
        fontSize: '14px',
        fontWeight: '500',
        fontFace: 'proxima-regular',
        color: 'rgb(107 114 128)',
        opacity: '.8'
    }),
    singleValue: (base) => ({
        ...base,
        paddingLeft: '6px',
        fontSize: '14px',
        fontWeight: '500',
        fontFace: 'proxima-regular',
        color: 'rgb(107 114 128)',
        opacity: '.8'
    }),
    valueContainer: (base) => ({
        ...base,
        padding: 0,
        paddingLeft: '8px',
        alignItems: 'top'
    })
};