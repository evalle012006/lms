import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import PDFDocument from 'pdfkit';
import fs, { chownSync } from 'fs';
import moment from 'moment';

export default apiHandler({
    get: getFile
});

async function getFile(req, res) {
    const { pid, file } = req.query;

    // generate path if not exists
    const path = 'public/documents';

    if (!fs.existsSync(path)) {
        fs.mkdir(path, (err) => {
            if (err) {
                throw err;
            }
            console.log("Directory is created.");
        });
    }

    const pdfFile = new Promise((resolve, reject) => {
        if (file == 'blend') {
            resolve(generateDryBlend(pid));
        }

        if (file == 'label') {
            resolve(generateBagLabel(pid));
        }

        if (file == 'quote') {
            resolve(generateCustomerQuote(pid));
        }
    });

    const result = await pdfFile;
    const response = { success: true, pid, file: result };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response));
}

const generateCustomerQuote = async (pid) => {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const logoWhite = './public/images/logo.png';
    const seal = './public/images/transparent-seal.png';
    const quote = './public/images/quote-bg.png';
    const path = 'public/documents';

    const blends = await db.collection('blendData')
        .aggregate([
            { $match: { _id: ObjectId(pid) } }
        ])
        .toArray();

    const numberOfBatches = 1;
    const products = blends[0].blendData;
    const spread = (products.reduce((a, b) => a + parseFloat(b.unit), 0)).toFixed(2);

    const totalcpha = products
        .map(p => {
            const marginPad = blends[0].margin !== 0 ? p.cost * blends[0].margin / 100 : 0;
            const partnerPad = blends[0].partner !== 0 ? p.cost * blends[0].partner / 100 : 0;
            const retail = parseFloat(marginPad) + parseFloat(partnerPad) + p.cost;
            const unit = p.unit ? parseInt(p.unit) : 0;
            return retail * unit;
        })
        .reduce((a, b) => a + b, 0);
    const gst = totalcpha != 0 ? (totalcpha / 10 * blends[0].hectares).toFixed(2) : ' - ';
    const totalvalue = totalcpha != 0 ? ((totalcpha + (totalcpha / 10)) * blends[0].hectares).toFixed(2) : ' - ';
    const investment = totalvalue
        * (blends[0].margin != 0 ? blends[0].margin / 100 : 1)
        * (blends[0].partner != 0 ? blends[0].partner / 100 : 1);

    const pdf = await new Promise(resolve => {
        const doc = new PDFDocument({ margin: 10, size: 'LETTER' });
        doc.pipe(fs.createWriteStream(`${path}/customer-quote.pdf`));

        const nutrients = [
            {
                label: 'Carbon', value: products.map(item => {
                    const value = item.nutrients['Carbon'] ? item.nutrients['Carbon'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Nitrogen', value: products.map(item => {
                    const value = item.nutrients['N'] ? item.nutrients['N'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Zinc', value: products.map(item => {
                    const value = item.nutrients['Zn'] ? item.nutrients['Zn'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Copper', value: products.map(item => {
                    const value = item.nutrients['Cu'] ? item.nutrients['Cu'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Manganese', value: products.map(item => {
                    const value = item.nutrients['Mn'] ? item.nutrients['Mn'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Iron', value: products.map(item => {
                    const value = item.nutrients['Fe'] ? item.nutrients['Fe'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Boron', value: products.map(item => {
                    const value = item.nutrients['B'] ? item.nutrients['B'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Sulfur', value: products.map(item => {
                    const value = item.nutrients['S'] ? item.nutrients['S'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Phosphorous', value: products.map(item => {
                    const value = item.nutrients['P'] ? item.nutrients['P'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Potassium', value: products.map(item => {
                    const value = item.nutrients['K'] ? item.nutrients['K'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Magnessium', value: products.map(item => {
                    const value = item.nutrients['Mn'] ? item.nutrients['Mn'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            },
            {
                label: 'Calcium', value: products.map(item => {
                    const value = item.nutrients['Ca'] ? item.nutrients['Ca'] : 0;
                    return value * item.unit;
                }).reduce((a, b) => a + parseFloat(b), 0)
            }
        ];

        // set fonts b0a595
        doc.registerFont('Alternate Gothic', './public/fonts/AlternateGotNo2D.otf')
            .registerFont('Proxima Nova', './public/fonts/proximanova-regular.otf')
            .registerFont('Proxima Bold', './public/fonts/proximanova-bold.otf')
            // create lines
            .moveTo(30, 25)
            .lineTo(582, 25)
            .strokeColor("#b0a595")
            .stroke()
            .moveTo(30, 120)
            .lineTo(582, 120)
            .stroke()
            // add image
            .image(logoWhite, 420, 40, { scale: 0.5 })
            // add text title
            .font('Alternate Gothic')
            .fontSize(46)
            .fillColor('#b0a595')
            .text(blends[0].name, 35, 60)
            .font('Proxima Nova')
            .fontSize(12)
            .text('Total kg of each element per ha supplied by this blend when applied at the recommended rate', 25, 135, {
                width: 557,
                align: 'center'
            })
            .save()
            // rotated text
            .rotate(90, {
                origin: [320, 267]
            })

        let startX = 240;
        let startY = 5;
        nutrients.map((item, index) => {
            const fill = index % 2 === 0 ? 'white' : '#efede9';
            // add text labels
            doc.rect(230, startY, 140, 47)
                .fill(fill);
            doc.fillColor('#b0a595')
                .text(item.label, startX, startY + 15);
            startY = startY + 46;
        })

        // restore orientation and loop for values again
        doc.restore();

        startX = 30;
        startY = 300;
        nutrients.reverse().map(item => {
            doc.font('Alternate Gothic')
                .fillColor('black')
                .fontSize(18)
                .text(item.value.toFixed(2), startX, startY, {
                    width: 46,
                    align: 'center'
                })
            startX = startX + 46;
        });

        // generate spread rate area and total blend required (use totals)
        doc.moveTo(30, 350)
            .lineTo(30, 430)
            .lineTo(582, 430)
            .lineTo(582, 350)
            .lineTo(29, 350)
            .stroke()
            // create line col divider
            .moveTo(209, 350)
            .lineTo(209, 430)
            .stroke()
            .moveTo(388, 350)
            .lineTo(388, 430)
            .stroke()
            // create row divider
            .moveTo(30, 390)
            .lineTo(582, 390)
            .stroke()

            // add labels
            .font('Proxima Bold')
            .fontSize(12)
            .fillColor('#b0a595')
            .text('SPREAD RATE', 25, 363, {
                width: 190,
                align: 'center'
            })
            .text('AREA', 202, 363, {
                width: 190,
                align: 'center'
            })
            .text('TOTAL BLEND REQUIRED', 385, 363, {
                width: 200,
                align: 'center'
            })
            .font('Alternate Gothic')
            .fillColor('black')
            .fontSize(24)
            .text(`${spread} Kg/Ha`, 25, 401, {
                width: 190,
                align: 'center'
            })
            .text(`${blends[0].hectares} Spread Ha`, 202, 401, {
                width: 200,
                align: 'center'
            })
            .text(`${(spread * blends[0].hectares).toFixed(2)} Kg`, 385, 401, {
                width: 200,
                align: 'center'
            })

            // add textboxes
            .rect(30, 460, 551, 30)
            .fill('#efede9')
            .rect(30, 520, 551, 30)
            .fill('#efede9')
            .rect(30, 580, 551, 30)
            .fill('#9ad1d0')

            // add texts
            .font('Proxima Nova')
            .fontSize(16)
            .fillColor('#b0a5a8')
            .text('Investment per HA', 40, 466)
            .text('Investment per Ton', 40, 496)
            .text('Total Value Exc GST', 40, 526)
            .text('GST Amount', 40, 556)
            .fillColor('black')
            .text('Total Vale Inc GST', 40, 586)
            .text(`$ ${totalvalue}`, 355, 466, {
                width: 200,
                align: 'right'
            })
            .text(`$ ${investment.toFixed(2)}`, 355, 496, {
                width: 200,
                align: 'right'
            })
            .text(`$ ${isNaN(gst) ? ' - ' : (totalvalue - gst).toFixed(2)}`, 355, 526, {
                width: 200,
                align: 'right'
            })
            .text(`$ ${gst}`, 355, 556, {
                width: 200,
                align: 'right'
            })
            .text(isNaN(totalvalue) ? ' - ' : `$ ${totalvalue}`, 355, 586, {
                width: 200,
                align: 'right'
            })
            .fontSize(10)
            .text(`Offer Date: ${moment().format('DD/MM/YYYY')}`, 30, 622, {
                width: 524,
                align: 'center'
            })
            .text('Valid for 14 days from offer date.', 30, 638, {
                width: 524,
                align: 'center'
            })
            // add images
            .image(quote, 29, 680, { scale: 0.43 })
            .image(seal, 480, 620, { scale: 0.15 })

        // finally generate pdf
        doc.end();

        doc.on("end", () => {
            resolve('customer-quote.pdf');
        });
    });

    return pdf;
}

const generateDryBlend = async (pid) => {
    let startX = 0;
    let startY = 0;
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const path = 'public/documents';

    const blends = await db.collection('blendData')
        .aggregate([
            { $match: { _id: ObjectId(pid) } }
        ])
        .toArray();

    const numberOfBatches = 1;
    const products = blends[0].blendData.map(item => {
        const kgha = blends[0].banding ? blends[0].banding / 100 * parseInt(item.unit) : parseInt(item.unit);
        item.kgha = kgha;
        item.totalkgha = kgha * blends[0].hectares;
        item.totalbatch = kgha * parseInt(blends[0].hectares) * numberOfBatches;
        return item;
    });
    const headers = [
        { label: 'PRODUCT NAME', width: 160, fill: "#dfdbd5" },
        { label: 'Kg/Ha', width: 40, fill: "white" },
        { label: 'Total kg in blend', width: 60, fill: "#dfdbd5" },
        { label: 'Total Kg per Batch', width: 60, fill: "white" }
    ];
    const totals = {
        kgha: products.reduce((a, b) => a + parseFloat(b.kgha), 0),
        totalkgha: products.reduce((a, b) => a + parseFloat(b.totalkgha), 0),
        totalbatch: products.reduce((a, b) => a + parseFloat(b.totalbatch), 0)
    };

    const pdf = await new Promise(resolve => {
        const doc = new PDFDocument({ margin: 10, size: 'LETTER' });
        doc.pipe(fs.createWriteStream(`${path}/blend-sheet.pdf`));

        // set fonts b0a595
        doc.registerFont('Alternate Gothic', './public/fonts/AlternateGotNo2D.otf')
            .registerFont('Proxima Nova', './public/fonts/proximanova-regular.otf')
            .moveTo(150, 30)
            .lineTo(150, 55)
            .lineTo(470, 55)
            .lineTo(470, 30)
            .lineTo(149, 30)
            .lineWidth(2)
            .strokeColor("#b0a595")
            .stroke()
            // rectangle fill 
            .rect(150, 30, 320, 25)
            .fill("#dfdbd5")
            // text
            .fillColor('black')
            .font('Alternate Gothic')
            .fontSize(19)
            .text('Dry Blend - Factory Blend Sheet', 150, 35, {
                width: 320,
                align: 'center'
            })
            // generate cells
            .moveTo(150, 55)
            .lineTo(150, 73)
            .lineTo(470, 73)
            .lineTo(470, 55)
            .stroke()
            // rectangle fill 
            .rect(150, 56, 320, 17)
            .fill("white")
            // blend title
            .font('Proxima Nova')
            .fontSize(12)
            .fillColor('#b0a595')
            .text(blends[0].name, 150, 58, {
                width: 320,
                align: 'center'
            })
            // header cells
            .moveTo(150, 73)
            .lineTo(150, 103)
            .lineTo(470, 103)
            .lineTo(470, 73)
            .stroke()
            // extra cells
            .moveTo(470, 30)
            .lineTo(510, 30)
            .lineTo(510, 103)
            .lineTo(470, 103)
            .stroke()
            .moveTo(470, 73)
            .lineTo(510, 73)
            .stroke()
            // create two rectangles with white background
            .rect(471, 30, 39, 43)
            .fill("white")
            .rect(471, 74, 39, 29)
            .fill("white")
            .rect(150, 74, 320, 29)
            .fill("white")
            // texts on extra cells
            .fillColor('#b0a595')
            .fontSize(8)
            .text('Number of Batches', 472, 32, {
                width: 37,
                align: 'center'
            })
            // value of number of batches
            .fillColor('#b0a595')
            .fontSize(16)
            .text('1', 472, 78, {
                width: 37,
                align: 'center'
            })

        startX = 150;
        startY = 74;
        headers.map((item, index) => {
            const size = index == 0 ? 14 : 8;
            const base = index == 1 ? 8 : (index === 0 ? 6 : 5);
            doc.rect(startX, startY, item.width, 29)
                .fill(item.fill)
                .fillColor('black')
                .fontSize(size)
                .text(item.label, startX + 3, startY + base, {
                    width: item.width - 5,
                    align: index == 0 ? 'left' : 'center'
                });
            startX = startX + item.width;
        });

        // generate cells for each product
        startX = 150;
        startY = 103;
        // 33 is just the number followed in the sheet
        Array(33).fill().map((_, key) => {
            const product = products[key];

            doc.moveTo(startX, startY)
                .lineTo(startX, startY + 16)
                .lineTo(startX + 320, startY + 16)
                .lineTo(startX + 320, startY)
                .stroke()
                .rect(startX, startY + 1, 320, 15)
                .fill("white");
            headers.map((item, index) => {
                doc.rect(startX, startY + 1, item.width, 15)
                    .fill(item.fill)
                    .fillColor('black')
                    .fontSize(9);

                if (product) {
                    index == 0 && doc.text(product.name, startX + 3, startY + 3, {
                        width: item.width - 5,
                        align: 'left'
                    });
                    index == 1 && doc.text(product.kgha, startX + 3, startY + 3, {
                        width: item.width - 5,
                        align: 'center'
                    });
                    index == 2 && doc.text(product.totalkgha, startX + 3, startY + 3, {
                        width: item.width - 8,
                        align: 'right'
                    });
                    index == 3 && doc.fontSize(15).text(product.totalbatch, startX + 3, startY, {
                        width: item.width - 8,
                        align: 'right'
                    });
                }
                startX = startX + item.width;
            });
            startY = startY + 16;
            startX = 150;
        });

        doc.moveTo(startX, startY)
            .lineTo(startX, startY + 16)
            .lineTo(startX + 320, startY + 16)
            .lineTo(startX + 320, startY)
            .stroke()
            .rect(startX, startY + 1, 320, 15)
            .fill("white");
        headers.map((item, index) => {
            doc.rect(startX, startY + 1, item.width, 15)
                .fill(item.fill)
                .fillColor('black')
                .fontSize(13);

            index == 0 && doc.font("Alternate Gothic")
                .text('Total Kg', startX + 3, startY + 4, {
                    width: item.width - 7,
                    align: 'right'
                });
            index == 1 && doc.font("Alternate Gothic")
                .text(totals['kgha'], startX + 3, startY + 4, {
                    width: item.width - 7,
                    align: 'right'
                });
            index == 2 && doc.font("Alternate Gothic")
                .text(totals['totalkgha'], startX + 3, startY + 4, {
                    width: item.width - 7,
                    align: 'right'
                });
            index == 3 && doc.font("Alternate Gothic")
                .text(totals['totalbatch'], startX + 3, startY + 4, {
                    width: item.width - 7,
                    align: 'right'
                });
            startX = startX + item.width;
        });

        startX = 150;
        startY = startY + 32;
        doc.rect(startX, startY, 320, 24)
            .fill("#dfdbd5")
            .rect(startX, startY + 44, 320, 38)
            .fill("#9ad1d0")
            // texts 
            // total blend
            .font('Proxima Nova')
            .fillColor('black')
            .fontSize(10)
            .text(`Total HA for Blend: ${blends[0].hectares}`, startX, startY + 6, {
                width: 320,
                align: 'center'
            })
            .text('Batch Number:', startX, startY + 28, {
                width: 140,
                align: 'right'
            })
            .fontSize(18)
            .text(blends[0].batchNumber, startX + 145, startY + 23)
            .font('Alternate Gothic')
            .fontSize(30)
            .text(`In ${blends[0].rateLabel} Bags`, startX, startY + 52, {
                width: 320,
                align: 'center'
            })
            // finally, write the document
            .end();

        doc.on("end", () => {
            // console.log(products)
            resolve('blend-sheet.pdf');
        });
    });

    return pdf;
}

const generateBagLabel = async (pid) => {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const path = 'public/documents';
    const blends = await db.collection('blendData')
        .aggregate([
            { $match: { _id: ObjectId(pid) } }
        ])
        .toArray();

    const products = blends[0].blendData;
    const spread = (products.reduce((a, b) => a + parseFloat(b.unit), 0)).toFixed(2);

    const pdf = await new Promise(resolve => {
        const doc = new PDFDocument({ margin: 10, size: 'LETTER' });
        const blendImg = './public/images/blend-bg.png';
        const logoWhite = './public/images/logo.png';

        doc.pipe(fs.createWriteStream(`${path}/bag-label.pdf`));
        // set fonts
        doc.registerFont('Alternate Gothic', './public/fonts/AlternateGotNo2D.otf')
            .registerFont('Proxima Nova', './public/fonts/proximanova-regular.otf')
            // insert image
            .image(blendImg, 187, 247, { scale: 0.70 })
            // insert logo
            .image(logoWhite, 80, 100, { scale: 0.5 })
            // insert text 
            .fillColor('#018D8A')
            .fontSize(12)
            .text('SPREAD RATE', 375, 80, {
                characterSpacing: 4
            })
            // create rectangle shape within spread rate
            .rect(327, 100, 220, 80)
            .strokeColor("#018D8A")
            .stroke()
            // spread rate
            .font('Alternate Gothic')
            .fillColor('black')
            .fontSize(56)
            .text(parseInt(spread), 330, 120, {
                width: 200,
                align: 'center'
            })
            .save()
            // rotated text
            .rotate(90, {
                origin: [210, 327]
            })
            .fillColor('#018D8A')
            .fontSize(24)
            .text('KG/HA', 0, 0)
            .restore()
            // title 
            .fontSize(50)
            .text(blends[0].name, 40, 250, {
                width: 532,
                align: 'center'
            })
            // data
            .font('Helvetica')
            .fillColor('#018D8A')
            .fontSize(14)
            .text('NET BAG WEIGHT', 40, 400, {
                width: 200,
                align: 'center'
            })
            .font('Helvetica')
            .fillColor('#018D8A')
            .fontSize(14)
            .text('BATCH NUMBER', 40, 495, {
                width: 200,
                align: 'center'
            })
            // create lines
            .moveTo(50, 420)
            .lineTo(230, 420)
            .stroke()
            .moveTo(50, 480)
            .lineTo(230, 480)
            .stroke()
            .moveTo(50, 520)
            .lineTo(230, 520)
            .stroke()
            .moveTo(50, 580)
            .lineTo(230, 580)
            .stroke()
            // data values
            .font('Alternate Gothic')
            .fillColor('black')
            .fontSize(26)
            .text(`${spread} kgs`, 40, 440, {
                width: 200,
                align: 'center'
            })
            .font('Alternate Gothic')
            .fillColor('black')
            .fontSize(26)
            .text(blends[0].batchNumber, 40, 540, {
                width: 200,
                align: 'center'
            })
            // other texts
            .font('Proxima Nova')
            .fillColor('black')
            .fontSize(12)
            .text('www.hybridag.com.au', 60, 600, {
                link: 'https://www.hybridag.com.au'
            })
            .font('Helvetica')
            .fontSize(9)
            .text('WARNING - the dust from this product may act as an irritant. Avoid inhalation and contact with the eyes and skin.', 60, 635, {
                width: 175
            })
            .fontSize(7)
            .text("PO Box 633\n52 Buckler Road, Wangaratta VIC 3676\nPh: 03 5722 7555\nABN: 64 169 962 823", 60, 685, {
                width: 160
            })
            .rect(40, 40, 532, 712)
            .strokeColor("#8B877A")
            .stroke()
            .end();

        doc.on("end", () => {
            resolve('bag-label.pdf');
        });
    });

    return pdf;
}