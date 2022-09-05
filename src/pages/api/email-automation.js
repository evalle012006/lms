import { connectToDatabase } from "@/lib/mongodb";
import { excelReader } from '@/lib/excel-reader';
import logger from "@/logger";

export default async function handler (req, res) {
    let response = {};
    fetch (process.env.NEXT_PUBLIC_API_URL + "gmail/save-messages-to-db")
      .then(response => {
        handleResponse(response).then(resp => {
          if (resp.success) {
            getMessagesFromDb()
              .then(resp => {
                if (resp && resp.length > 0) {
                    resp.map(message => {
                        getMessage(message.messageId);
                    });
                }
              });
          }
        });
      });

    response = {success: true}

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response));
}

const handleResponse = (response) => {
    return response.text().then(text => {
      const data = text && JSON.parse(text);

      if (!response.ok) {
        const error = (data && data.message) || response.statusText;
        return Promise.reject(error);
      }

      return data;

    });
}

const getMessagesFromDb = async () => {
  const { db } = await connectToDatabase();

  const emails = await db
      .collection('emails')
      .find({ 'processed': false})
      .toArray();

  return emails;
}

const saveToDb = async (messageId, type, data) => {
    const { db } = await connectToDatabase();
    // create job
    if (type === 'soil') {
        // const jobData = {
        //     contact: '',
        //     name: data.job,
        //     property: '',
        //     type: type,
        //     email: 'hybridag@castledigital.com.au',
        //     stage: 0,
        //     status: 'created'
        // }
        
        // const job = await db.collection('jobs').insertOne({
        //     ...jobData,
        //     dateAdded: new Date().toISOString()
        // });
        
        // if (job && job.acknowledged) {
            const testData = {...data.soil, job_id: null};
            const test = await db.collection('tests').insertOne({
                ...testData,
                dateAdded: new Date().toISOString()
            });

            if (test.acknowledged) {
                updateEmailMessage(messageId);
            }
        // }
    } else if (type === 'leaf') {
        data && data.map((t) => {
            saveLeafData(messageId, t);
        });
    }
    
  }

  const saveLeafData = async(messageId, leaf) => {
    const { db } = await connectToDatabase();
    // const jobData = {
    //     contact: '',
    //     name: leaf.name,
    //     property: leaf.property,
    //     type: "leaf",
    //     email: 'hybridag@castledigital.com.au',
    //     stage: 0,
    //     status: 'created'
    // }
    
    // const job = await db.collection('jobs').insertOne({
    //     ...jobData,
    //     dateAdded: new Date().toISOString()
    // });
    
    // if (job && job.acknowledged) {
        const testData = {...leaf, job_id: null};
        const test = await db.collection('tests').insertOne({
            ...testData,
            dateAdded: new Date().toISOString()
        });

        if (test.acknowledged) {
            updateEmailMessage(messageId);
        }
    // }
  }

  const updateEmailMessage = async (messageId) => {
    const { db } = await connectToDatabase();
    const email = await db.collection('emails')
        .updateOne(
            {messageId: messageId},
            {
                $set: {
                    processed: true
                }
            }
        );
  }


  const processSoilData = (messageId, rawData) => {
    // console.log(rawData);
    let cellJobData = [];
    let cellData = [];
    rawData && rawData.map((row, index) => {
      if (index === 2) { // job data
        row && row.map(cell => {
          cellJobData.push(cell);
        });
      } else if (index === 9) { // this is the row for cellData
        row && row.map(cell => {
          cellData.push(cell);
        });
      }
    });

    let soilData = {};
    let soilNutrients = {};

    cellData && cellData.map((data, index) => {
      if (index === 0) {
        soilData = {...soilData, labnumber: data};
      } else if (index === 1) {
        soilData = {...soilData, name: data};
      } else if (index === 2) {
        soilData = {...soilData, crop: data};
      } else if (index === 3) {
        soilData = {...soilData, client: data};
      } else if (index === 4) {
        soilNutrients = {...soilNutrients, depth: data};
      } else if (index === 5) {
        soilNutrients = {...soilNutrients, color: data};
      } else if (index === 6) {
        soilNutrients = {...soilNutrients, gravel: data};
      } else if (index === 7) {
        soilNutrients = {...soilNutrients, texture: data};
      } else if (index === 8) {
        soilNutrients = {...soilNutrients, ammnit: data};
      } else if (index === 9) {
        soilNutrients = {...soilNutrients, nitnit: data};
      } else if (index === 10) {
        soilNutrients = {...soilNutrients, "col-p": data};
      } else if (index === 11) {
        soilNutrients = {...soilNutrients, "col-k": data};
      } else if (index === 12) {
        soilNutrients = {...soilNutrients, sulphur: data};
      } else if (index === 13) {
        soilNutrients = {...soilNutrients, orgcar: data};
      } else if (index === 14) {
        soilNutrients = {...soilNutrients, conductivity: data};
      } else if (index === 15) {
        soilNutrients = {...soilNutrients, "ph-01": data};
      } else if (index === 16) {
        soilNutrients = {...soilNutrients, "ph-02": data};
      } else if (index === 17) {
        soilNutrients = {...soilNutrients, "dtpa-cu": data};
      } else if (index === 18) {
        soilNutrients = {...soilNutrients, "dtpa-fe": data};
      } else if (index === 19) {
        soilNutrients = {...soilNutrients, "dtpa-mn": data};
      } else if (index === 20) {
        soilNutrients = {...soilNutrients, "dtpa-zn": data};
      } else if (index === 21) {
        soilNutrients = {...soilNutrients, "exc-al": data};
      } else if (index === 22) {
        soilNutrients = {...soilNutrients, "exc-ca": data};
      } else if (index === 23) {
        soilNutrients = {...soilNutrients, "exc-mn": data};
      } else if (index === 24) {
        soilNutrients = {...soilNutrients, "exc-k": data};
      } else if (index === 25) {
        soilNutrients = {...soilNutrients, "exc-na": data};
      } else if (index === 26) {
        soilNutrients = {...soilNutrients, "cacl2": data};
      } else if (index === 27) {
        soilNutrients = {...soilNutrients, chloride: data};
      } else if (index === 28) {
        soilNutrients = {...soilNutrients, "total-p": data};
      } else if (index === 29) {
        soilNutrients = {...soilNutrients, ece: data};
      } else if (index === 30) {
        soilNutrients = {...soilNutrients, "paste-ca": data};
      } else if (index === 31) {
        soilNutrients = {...soilNutrients, "paste-k": data};
      } else if (index === 32) {
        soilNutrients = {...soilNutrients, "paste-mg": data};
      } else if (index === 33) {
        soilNutrients = {...soilNutrients, "paste-na": data};
      } else if (index === 34) {
        soilNutrients = {...soilNutrients, "paste-percent": data};
      }
    });

    soilData = {...soilData, testType: "soil", nutrients: soilNutrients};
    const finalData = {job: cellJobData[1], soil: soilData};

    saveToDb(messageId, "soil", finalData);
  }

  const processLeafData = (messageId, rawData) => {
    // console.log(rawData);

    let rowData = [];
    rawData && rawData.map((row, index) => {
      if (index > 0) { // this is the row for cellData
        if (row.length > 20) {
          rowData.push(row);
        }
      }
    });

    let leafTestList = [];
    let leafData = {};
    let leafNutrients = {young: {}, old: {}};
    rowData && rowData.map((row) => {
      let young = row.includes("Leaf (young)", 7);
      if (young) {
        if (Object.keys(leafData).length > 0) {
          leafData = {...leafData, testType: "leaf", nutrients: leafNutrients};
          leafTestList.push(leafData);
        }

        leafData = {};
      }
      row && row.map((cell, idx) => {
        if (idx === 1) {
          leafData = {...leafData, dateTaken: cell};
        } else if (idx === 2) {
          if (young) {
            leafData = {...leafData, sampleYoung: cell};
          } else {
            leafData = {...leafData, sampleOld: cell};
          }
        } else if (idx === 3) {
          leafData = {...leafData, name: cell};
        } else if (idx === 4) {
          leafData = {...leafData, property: cell};
        } else if (idx === 5) {
          // skip
          // leafData = {...leafData, name: cell};
        } else if (idx === 6) {
          leafData = {...leafData, crop: cell};
        } else if (idx === 7) {
          // skip
          // leafData = {...leafData, name: cell};
        } else if (idx > 13) {
          if (young) {
            if (idx === 14) {
              leafNutrients.young = {...leafNutrients.young, sugar: cell};
            } else if (idx === 15) {
              leafNutrients.young = {...leafNutrients.young, ph: cell};
            } else if (idx === 16) {
              leafNutrients.young = {...leafNutrients.young, ec: cell};
            } else if (idx === 17) {
              leafNutrients.young = {...leafNutrients.young, k: cell};
            } else if (idx === 18) {
              leafNutrients.young = {...leafNutrients.young, ca: cell};
            } else if (idx === 19) {
              leafNutrients.young = {...leafNutrients.young, kca: cell};
            } else if (idx === 20) {
              leafNutrients.young = {...leafNutrients.young, mg: cell};
            } else if (idx === 21) {
              leafNutrients.young = {...leafNutrients.young, na: cell};
            } else if (idx === 22) {
              leafNutrients.young = {...leafNutrients.young, nh4: cell};
            } else if (idx === 23) {
              leafNutrients.young = {...leafNutrients.young, no3: cell};
            } else if (idx === 24) {
              leafNutrients.young = {...leafNutrients.young, "n-nit": cell};
            } else if (idx === 25) {
              leafNutrients.young = {...leafNutrients.young, "n-total": cell};
            } else if (idx === 26) {
              leafNutrients.young = {...leafNutrients.young, cl: cell};
            } else if (idx === 27) {
              leafNutrients.young = {...leafNutrients.young, s: cell};
            } else if (idx === 28) {
              leafNutrients.young = {...leafNutrients.young, p: cell};
            } else if (idx === 29) {
              leafNutrients.young = {...leafNutrients.young, si: cell};
            } else if (idx === 30) {
              leafNutrients.young = {...leafNutrients.young, fe: cell};
            } else if (idx === 31) {
              leafNutrients.young = {...leafNutrients.young, mn: cell};
            } else if (idx === 32) {
              leafNutrients.young = {...leafNutrients.young, zn: cell};
            } else if (idx === 33) {
              leafNutrients.young = {...leafNutrients.young, b: cell};
            } else if (idx === 34) {
              leafNutrients.young = {...leafNutrients.young, cu: cell};
            } else if (idx === 35) {
              leafNutrients.young = {...leafNutrients.young, mo: cell};
            } else if (idx === 36) {
              leafNutrients.young = {...leafNutrients.young, al: cell};
            }
          } else {
            if (idx === 14) {
              leafNutrients.old = {...leafNutrients.old, sugar: cell};
            } else if (idx === 15) {
              leafNutrients.old = {...leafNutrients.old, ph: cell};
            } else if (idx === 16) {
              leafNutrients.old = {...leafNutrients.old, ec: cell};
            } else if (idx === 17) {
              leafNutrients.old = {...leafNutrients.old, k: cell};
            } else if (idx === 18) {
              leafNutrients.old = {...leafNutrients.old, ca: cell};
            } else if (idx === 19) {
              leafNutrients.old = {...leafNutrients.old, kca: cell};
            } else if (idx === 20) {
              leafNutrients.old = {...leafNutrients.old, mg: cell};
            } else if (idx === 21) {
              leafNutrients.old = {...leafNutrients.old, na: cell};
            } else if (idx === 22) {
              leafNutrients.old = {...leafNutrients.old, nh4: cell};
            } else if (idx === 23) {
              leafNutrients.old = {...leafNutrients.old, no3: cell};
            } else if (idx === 24) {
              leafNutrients.old = {...leafNutrients.old, "n-nit": cell};
            } else if (idx === 25) {
              leafNutrients.old = {...leafNutrients.old, "n-total": cell};
            } else if (idx === 26) {
              leafNutrients.old = {...leafNutrients.old, cl: cell};
            } else if (idx === 27) {
              leafNutrients.old = {...leafNutrients.old, s: cell};
            } else if (idx === 28) {
              leafNutrients.old = {...leafNutrients.old, p: cell};
            } else if (idx === 29) {
              leafNutrients.old = {...leafNutrients.old, si: cell};
            } else if (idx === 30) {
              leafNutrients.old = {...leafNutrients.old, fe: cell};
            } else if (idx === 31) {
              leafNutrients.old = {...leafNutrients.old, mn: cell};
            } else if (idx === 32) {
              leafNutrients.old = {...leafNutrients.old, zn: cell};
            } else if (idx === 33) {
              leafNutrients.old = {...leafNutrients.old, b: cell};
            } else if (idx === 34) {
              leafNutrients.old = {...leafNutrients.old, cu: cell};
            } else if (idx === 35) {
              leafNutrients.old = {...leafNutrients.old, mo: cell};
            } else if (idx === 36) {
              leafNutrients.old = {...leafNutrients.old, al: cell};
            }
          }
        }
      });
    });

    // save data to test table in database
    // console.log(leafTestList);
    saveToDb(messageId, "leaf", leafTestList);
  }

  const getMessage = (messageId) => {
    fetch(process.env.NEXT_PUBLIC_API_URL + "gmail/read-email/?messageId=" + messageId)
      .then(response => {
        handleResponse(response).then(resp => {
          // console.log(resp);
          if (resp) {
            // console.log("----------------------");
            // console.log(resp.payload);
            const headers = resp.payload.headers;
            const subjectHeader = headers.find(h => h.name === 'Subject');
            // soil = "soil analysis data"
            // leaf = "soil analysis report"
            const parts = resp.payload.parts;
            const partFiles = parts && parts.filter(p => p.filename.includes('xls') || p.filename.includes('xlsx') || p.filename.includes('xlsx'));
            // soil = "csbp..."
            // leaf = mostly more than 1 attachments
            const attachmentId = partFiles && partFiles.length > 0 && partFiles[0].body.attachmentId;
            const fileName = partFiles && partFiles.length > 0 && partFiles[0].filename.toLowerCase();
            // console.log(partFiles);
            if (attachmentId) {
              if (subjectHeader.value.toLowerCase().includes("soil") && fileName.includes("csbp")) {
                // this is a soil
                getAttachments("soil", messageId, attachmentId);
              } else if (subjectHeader.value.toLowerCase().includes("report") || subjectHeader.value.toLowerCase().includes("reports")) {
                // this is a leaf
                getAttachments("leaf", messageId, attachmentId);
              }
            } else {
              logger.debug("NO ATTACHMENT");
              updateEmailMessage(messageId);
            }
          }
        });
      });
  }

  const getAttachments = (type, messageId, attachmentId) => {
    fetch(process.env.NEXT_PUBLIC_API_URL + `gmail/get-attachments/?messageId=${messageId}&id=${attachmentId}`)
      .then(response => {
        handleResponse(response).then(resp => {
          if (resp.data) {
            const data = excelReader(resp.data); 
            if (type === 'soil') {
              processSoilData(messageId, data);
            } else if (type === 'leaf') {
              processLeafData(messageId, data);
            }
          }
        });
      });
  }

const getAllMessages = async () => {

    fetch (process.env.NEXT_PUBLIC_API_URL + "gmail/get-messages");
    //     .then(response => {
    //     handleResponse(response).then(resp => {
    //         if (resp.messages) {
    //             resp.messages.map(msg => {
    //                 // check first if the messageId exist in the database
    //                 // we need to save this messageId to a table
                    
                    
    //                 // getMessage(msg.id);
    //             });
    //             // in here we can save all the messages from the inbox to the database
    //             // just check if the messageId exist if exist don't save
    //         }
    //     });
    // });
}