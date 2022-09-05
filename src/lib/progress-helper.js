export const getProgress = (program) => {
    const products = getProductsList(program);
    const count = products.filter(p => p.checked).length;
    const total = count / products.length;
    return (total * 100).toFixed();
}

export const getColData = (program, col) => {
    const products = getProductsList(program);
    const list = products.filter(p => p.index == col);
    return list.length > 0 && list;
}

export const checkColData = (program, col) => {
    const products = getProductsList(program);
    const list = products.filter(p => p.index == col);
    return !(list.filter(p => !p.checked).length > 0);
}

const getProductsList = (program) => {
    let list = [];
    program?.products?.forEach(group => {
        group.data.forEach(product => {
            product.application.map(item => {
                item.product = product.product;
                item.group = group.type;
                list = [...list, item];
            });
        });
    });

    return list;
}