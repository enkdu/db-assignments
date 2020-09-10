'use strict';

/********************************************************************************************
 *                                                                                          *
 * The goal of the task is to get basic knowledge of mongodb functions and                  *
 * approaches to work with data in mongodb. Most of the queries should be implemented with  *
 * aggregation pipelines.                                                                   *
 * https://docs.mongodb.com/manual/reference/aggregation/                                   *
 * https://docs.mongodb.com/manual/reference/operator/aggregation/                          *
 *                                                                                          *
 * The course do not includes basic syntax explanations                                     *
 * Start from scratch can be complex for the tasks, if it's the case, please check          *
 * "MongoDB University". The M001 course starts quite often so you can finish it to get     *
 * the basic understanding.                                                                 *
 * https://university.mongodb.com/courses/M001/about                                        *
 *                                                                                          *
 ********************************************************************************************/

/**
 * The function is to add indexes to optimize your queries.
 * Test timeout is increased to 15sec for the function.
 * */
async function before(db) {
    await db.collection('employees').ensureIndex({CustomerID: 1});
    await db.collection('customers').createIndex({CustomerID: 1});
    await db.collection('order-details').createIndex({OrderID: 1});
    await db.collection('order-details').createIndex({ProductID: 1});
    await db.collection('orders').createIndex({OrderID: 1});
    await db.collection('orders').createIndex({CustomerID: 1});
    await db.collection('products').createIndex({ProductID: 1});
}

/**
 *  Create a query to return next data ordered by city and then by name:
 * | Employy Id | Employee Full Name | Title | City |
 *
 * NOTES: if City is null - show city as "Unspecified"
 */
async function task_1_1(db) {
    // The first task is example, please follow the style in the next functions.
    const result = await db.collection('employees').aggregate([
        {
            $project: {
                _id: 0,
                EmployeeID: 1,
                "Employee Full Name": {$concat: ["$FirstName", " ", "$LastName"]},
                Title: 1,
                City: {$ifNull: ['$City', "Unspecified"]}
            }
        },
        {$sort: {City: 1, "Employee Full Name": 1}}
    ]).toArray();
    return result;
}

/**
 *  Create a query to return an Order list ordered by order id descending:
 * | Order Id | Order Total Price | Total Order Discount, % |
 *
 * NOTES:
 *  - Discount in OrderDetails is a discount($) per Unit.
 *  - Round all values to MAX 3 decimal places
 */
async function task_1_2(db) {
    const result = await db.collection('order-details').aggregate([
        {
            $group: {
              _id: '$OrderID',
              totalPrice: {
                $sum: {$multiply: ['$UnitPrice', '$Quantity']}
              },
              totalDiscount: {
                $sum: {$multiply: ['$Discount', '$Quantity']}
              }
            }
          }, {
            $project: {
              _id: 0,
              'Order Id': '$_id',
              'Order Total Price':{$round: ["$totalPrice", 3]},
              'Total Order Discount, %':
                {$round: [
                  {$multiply: [
                    {$divide: ['$totalDiscount','$totalPrice']},
                    100]}, 3]}
            }
          }, {$sort: {'Order Id': -1}}
    ]).toArray();
    return result;
}

/**
 *  Create a query to return all customers without Fax, order by CustomerID:
 * | CustomerID | CompanyName |
 *
 * HINT: check by string "NULL" values
 */
async function task_1_3(db) {
    const result = await db.collection('customers').aggregate([
        {$match: {Fax: 'NULL'}}, 
        {
            $project: {
                _id: 0, 
                CustomerID: 1, 
                CompanyName: 1
            }
        }, {$sort: {CustomerID: 1}}
    ]).toArray();
    return result;
}

/**
 * Create a query to return:
 * | Customer Id | Total number of Orders | % of all orders |
 *
 * Order data by % - higher percent at the top, then by CustomerID asc.
 * Round all values to MAX 3 decimal places.
 *
 * HINT: that can done in 2 queries to mongodb.
 *
 */
async function task_1_4(db) {
    const orders = await db.collection('orders').countDocuments();
    const result = await db.collection('orders').aggregate([
        {
            $group: {
                _id: '$CustomerID',
               count: { $sum: 1 }
            }
        }, {
            $project: {
                _id: 0,
                'Customer Id': '$_id',
                'Total number of Orders': '$count',
                '% of all orders': {
                    $round: 
                      [{$divide: [{$multiply: ['$count', 100]}, orders]}, 3]
                }
            }
        }, {$sort: {'% of all orders': -1, 'Customer Id': 1}}
    ]).toArray();
    return result;
}

/**
 * Return all products where product name starts with 'A', 'B', .... 'F' ordered by name.
 * | ProductID | ProductName | QuantityPerUnit |
 */
async function task_1_5(db) {
    const result = await db.collection('products').aggregate([
        {$match: {ProductName: {$regex: /^[A-F]/}}}, 
        {
            $project: {
                _id: 0,
                ProductID: 1,
                ProductName: 1,
                QuantityPerUnit: 1
            }
        }, {$sort: {ProductName: 1}}
    ]).toArray();
    return result;
}

/**
 *
 * Create a query to return all products with category and supplier company names:
 * | ProductName | CategoryName | SupplierCompanyName |
 *
 * Order by ProductName then by SupplierCompanyName
 *
 * HINT: see $lookup operator
 *       https://docs.mongodb.com/manual/reference/operator/aggregation/lookup/
 */
async function task_1_6(db) {
    const result = await db.collection('categories').aggregate([
        {
            $lookup: {
                from: 'products',
                localField: 'CategoryID',
                foreignField: 'CategoryID',
                as: 'products'
          }
        }, {$unwind: '$products'}, 
        {
            $lookup: {
                from: 'suppliers',
                localField: 'products.SupplierID',
                foreignField: 'SupplierID',
                as: 'suppliers'
          }
        }, {$unwind: '$suppliers'}, 
        {
            $project: {
                _id: 0,
                ProductName: '$products.ProductName',
                CategoryName: 1,
                SupplierCompanyName: '$suppliers.CompanyName'
          }
        }, {
            $sort: {
                ProductName: 1,
                SupplierCompanyName: 1
          }
        }  
    ]).toArray();
    return result;
}

/**
 *
 * Create a query to return all employees and full name of person to whom this employee reports to:
 * | EmployeeID | FullName | ReportsTo |
 *
 * Full Name - title of courtesy with full name.
 * Order data by EmployeeID.
 * Reports To - Full name. If the employee does not report to anybody leave "-" in the column.
 */
async function task_1_7(db) {
    const result = await db.collection('employees').aggregate([
        {
            $lookup: {
                from: 'employees',
                localField: 'ReportsTo',
                foreignField: 'EmployeeID',
                as: 'reports'
            }
        }, {$unwind: {
            path: '$reports',
            preserveNullAndEmptyArrays: true
          }
        }, {
            $project: {
                _id: 0,
                EmployeeID: 1,
                FullName: {$concat: 
                  ['$TitleOfCourtesy','$FirstName',' ','$LastName']},
                ReportsTo: {$ifNull: 
                  [{$concat: ['$reports.FirstName',' ','$reports.LastName']}, '-']}
            }
        }, {$sort: {EmployeeID: 1}}
    ]).toArray();
    return result;
}

/**
 *
 * Create a query to return:
 * | CategoryName | TotalNumberOfProducts |
 * Order by CategoryName
 */
async function task_1_8(db) {
    const result = await db.collection('categories').aggregate([
        {
            $lookup: {
                from: 'products',
                localField: 'CategoryID',
                foreignField: 'CategoryID',
                as: 'products'
            }
        }, {$unwind: '$products'}, 
        {
            $group: {
                _id: '$CategoryName',
                count: {$sum: 1}
          }
        }, {
            $project: {
                _id: 0,
                CategoryName: '$_id',
                TotalNumberOfProducts: '$count'
          }
        }, {$sort: {CategoryName: 1}}
    ]).toArray();
    return result;
}

/**
 *
 * Create a query to find those customers whose contact name containing the 1st character is 'F' and the 4th character is 'n' and rests may be any character.
 * | CustomerID | ContactName |
 * order by CustomerID
 */
async function task_1_9(db) {
    const result = await db.collection('customers').aggregate([
        {
            $project: {
                _id: 0,
                CustomerID: 1,
                ContactName: 1
            }
        }, {
            $match: {
                ContactName: {
                    $regex: /^F..n/
                }
            }
        }
    ]).toArray();
    return result;
}

/**
 * Write a query to get discontinued Product list:
 * | ProductID | ProductName |
 * order by ProductID
 */
async function task_1_10(db) {
    const result = await db.collection('products').aggregate([
        {
            $match: {
                Discontinued: {
                    $eq: 1
                }
            }
        }, {
            $project: {
                _id: 0,
                ProductID: 1,
                ProductName: 1
            }
        }
    ]).toArray();
    return result;
}

/**
 * Create a query to get Product list (name, unit price) where products cost between $5 and $15:
 * | ProductName | UnitPrice |
 *
 * Order by UnitPrice then by ProductName
 */
async function task_1_11(db) {
    const result = await db.collection('products').aggregate([
        {
            $match: {
                UnitPrice: {
                    $gte: 5,
                    $lte: 15
                }
            }
        }, {
            $project: {
                _id: 0,
                ProductName: 1,
                UnitPrice: 1
            }
        }, {
            $sort: {
                UnitPrice: 1,
                ProductName: 1
            }
        }
    ]).toArray();
    return result;
}

/**
 * Write a SQL query to get Product list of twenty most expensive products:
 * | ProductName | UnitPrice |
 *
 * Order products by price (asc) then by ProductName.
 */
async function task_1_12(db) {
    const result = await db.collection('products').aggregate([
        {$sort: {UnitPrice: -1}}, 
        {$limit: 20}, 
        {
        $project: {
            _id: 0,
            ProductName: 1,
            UnitPrice: 1
        }
        }, {
        $sort: {
            UnitPrice: 1,
            ProductName: 1
          }
        }
    ]).toArray();
    return result;
}

/**
 * Create a query to count current and discontinued products:
 * | TotalOfCurrentProducts | TotalOfDiscontinuedProducts |
 *
 * HINT: That's acceptable to make it in 2 queries
 */
async function task_1_13(db) {
    const result = await db.collection('products').aggregate([
        {
            $group: {
              _id: 0,
              TotalOfCurrentProducts: {
                $sum: 1
              },
            TotalOfDiscontinuedProducts : { $sum : '$Discontinued' }
          }
        }, {$project: {_id: 0}}
    ]).toArray();
    return result[0];
}

/**
 * Create a query to get Product list of stock is less than the quantity on order:
 * | ProductName | UnitsOnOrder| UnitsInStock |
 * Order by ProductName
 *
 * HINT: see $expr operator
 *       https://docs.mongodb.com/manual/reference/operator/query/expr/#op._S_expr
 */
async function task_1_14(db) {
    const result = await db.collection('products').aggregate([
        {
            $match: {
                $expr: { $gt: [ "$UnitsOnOrder" , "$UnitsInStock" ] } 
            }
        }, {
            $project: {
                _id: 0,
                ProductName: 1,
                UnitsOnOrder: 1,
                UnitsInStock: 1
            }
        }, {$sort: {ProductName: 1}}
    ]).toArray();
    return result;
}

/**
 * Create a query to return the total number of orders for every month in 1997 year:
 * | January | February | March | April | May | June | July | August | September | November | December |
 *
 * HINT: see $dateFromString
 *       https://docs.mongodb.com/manual/reference/operator/aggregation/dateFromString/
 */
async function task_1_15(db) {
    const result = await db.collection('orders').aggregate([
        {
            $project: {
                _id: 0,
                date: { $dateFromString: 
                    {dateString: '$OrderDate'}
                },
            }
        }, {
            $project: {
                date: 1,
                year: {$year: '$date'},
                month: {$month: '$date'}
            }
        }, {$match: {year: 1997}
        }, {
            $group: {
                _id: '$year',
                January: {
                    $sum: {$cond: [{ $eq: [ "$month", 1 ] }, 1, 0]}
                },
                February: {
                    $sum: {$cond: [{ $eq: [ "$month", 2 ] }, 1, 0]}
                },
                March: {
                    $sum: {$cond: [{ $eq: [ "$month", 3 ] }, 1, 0]}
                },
                April: {
                    $sum: {$cond: [{ $eq: [ "$month", 4 ] }, 1, 0]}
                },
                May: {
                    $sum: {$cond: [{ $eq: [ "$month", 5 ] }, 1, 0]}
                },
                June: {
                    $sum: {$cond: [{ $eq: [ "$month", 6 ] }, 1, 0]}
                },
                July: {
                    $sum: {$cond: [{ $eq: [ "$month", 7 ] }, 1, 0]}
                },
                August: {
                    $sum: {$cond: [{ $eq: [ "$month", 8 ] }, 1, 0]}
                },
                September: {
                    $sum: {$cond: [{ $eq: [ "$month", 9 ] }, 1, 0]}
                },
                October: {
                    $sum: {$cond: [{ $eq: [ "$month", 10 ] }, 1, 0]}
                },
                November: {
                    $sum: {$cond: [{ $eq: [ "$month", 11 ] }, 1, 0]}
                },
                December: {
                    $sum: {$cond: [{ $eq: [ "$month", 12 ] }, 1, 0]}
                }
            }
        }, {$project: {_id: 0}}
    ]).toArray();
    return result[0];
}

/**
 * Create a query to return all orders where ship postal code is provided:
 * | OrderID | CustomerID | ShipCountry |
 * Order by OrderID
 */
async function task_1_16(db) {
    const result = await db.collection('orders').aggregate([
        {
            $project: {
                _id: 0,
                CustomerID: 1,
                OrderID: 1,
                ShipCountry: 1
          }
        }, {$sort: {OrderID: 1}}
    ]).toArray();
    return result;
}

/**
 * Create SQL query to display the average price of each categories's products:
 * | CategoryName | AvgPrice |
 * Order by AvgPrice descending then by CategoryName
 * NOTES:
 *  - Round AvgPrice to MAX 2 decimal places
 */
async function task_1_17(db) {
    const result = await db.collection('categories').aggregate([
        {
            $lookup: {
                from: 'products',
                localField: 'CategoryID',
                foreignField: 'CategoryID',
                as: 'products'
            }
        }, {$unwind: '$products',}, 
        {
            $group: {
                _id: '$CategoryName',
                AvgPrice: 
                    {$avg: '$products.UnitPrice'}
            }
        }, {
            $project: {
                _id: 0,
                CategoryName: '$_id',
                AvgPrice: {$round: ['$AvgPrice', 2]}
          }
        }, {
            $sort: {
                AvgPrice: -1,
                CategoryName: 1
            }
        }
    ]).toArray();
    return result;
}

/**
 * Create a query to calcualte total orders count by each day in 1998:
 * | Order Date | Total Number of Orders |
 *
 * Order Date needs to be in the format '%Y-%m-%d'
 * Order by Order Date
 *
 * HINT: see $dateFromString, $dateToString
 *       https://docs.mongodb.com/manual/reference/operator/aggregation/dateToString/
 *       https://docs.mongodb.com/manual/reference/operator/aggregation/dateFromString/
 */
async function task_1_18(db) {
    const result = await db.collection('orders').aggregate([
        {
            $project: {
                _id: 0,
                date: { $dateFromString:
                    {dateString: '$OrderDate'}
                }
            }
        }, {$addFields: {year: {$year: '$date'}}
        }, {$match: {year: 1998}
        }, {
            $group: {
                _id: '$date',
                count: {$sum: 1}
            }
        }, {
            $project: {
                _id: 0,
                'Order Date': { $dateToString: {
                    date: '$_id',
                    format: "%Y-%m-%d"
            }},
            'Total Number of Orders': '$count'
          }}, {$sort: {'Order Date': 1}}
    ]).toArray();
    return result;
}

/**
 * Create a query to display customer details whose total orders amount is more than 10000$:
 * | CustomerID | CompanyName | TotalOrdersAmount, $ |
 *
 * Order by "TotalOrdersAmount, $" descending then by CustomerID
 *  NOTES:
 *  - Round TotalOrdersAmount to MAX 2 decimal places
 *
 *  HINT: the query can be slow, you need to optimize it and pass in 2 seconds
 *       - https://docs.mongodb.com/manual/tutorial/analyze-query-plan/
 *       - quite often you can solve performance issues just with adding PROJECTIONS.
 *         *** Use Projections to Return Only Necessary Data ***
 *         https://docs.mongodb.com/manual/tutorial/optimize-query-performance-with-indexes-and-projections/#use-projections-to-return-only-necessary-data
 *       - do not hesitate to "ensureIndex" in "before" function at the top if needed https://docs.mongodb.com/manual/reference/method/db.collection.ensureIndex/
 */
async function task_1_19(db) {
    const result = await db.collection('customers').aggregate([
        {
            $lookup: {
                from: 'orders',
                localField: 'CustomerID',
                foreignField: 'CustomerID',
                as: 'orders'
            }
        }, {$unwind: '$orders'}, 
        {
            $lookup: {
                from: 'order-details',
                localField: 'orders.OrderID',
                foreignField: 'OrderID',
                as: 'details'
          }}, {$unwind: '$details'}, 
          {
            $group: {
                _id: '$CustomerID',
                CustomerID: {
                    $first: '$CustomerID'
                },
                CompanyName: {
                    $first: '$CompanyName'
                },
                'TotalOrdersAmount, $': {
                  $sum: {
                    $round: 
                      [{$multiply: ['$details.UnitPrice', '$details.Quantity']}, 2]
                  }
                },
            }
          }, {$match: {'TotalOrdersAmount, $': { $gte: 10000 }}}, 
          {$project: {_id: 0}}, 
          {
              $sort: {
                  'TotalOrdersAmount, $': -1,
                  CustomerID: 1
              }
          }
    ]).toArray();
    return result;
}

/**
 *
 * Create a query to find the employee that sold products for the largest amount:
 * | EmployeeID | Employee Full Name | Amount, $ |
 */
async function task_1_20(db) {
    const result = await db.collection('orders').aggregate([
        {
            $lookup: {
                from: 'order-details',
                localField: 'OrderID',
                foreignField: 'OrderID',
                as: 'order'
            }
        }, {$unwind: '$order'}, 
        {
            $group: {
                _id: '$EmployeeID',
                total: {
                  $sum: {$multiply: ['$order.UnitPrice', '$order.Quantity']}
                }
            }
        }, {$sort: {total: -1}}, 
        {$limit: 1}, 
        {
            $lookup: {
                from: 'employees',
                localField: '_id',
                foreignField: 'EmployeeID',
                as: 'employee'
            }
        }, {$unwind: '$employee'}, 
        {
            $project: {
                _id: 0,
                'Amount, $' : '$total',
                'Employee Full Name':{
                  $concat: ['$employee.FirstName',' ','$employee.LastName']
                },
                EmployeeID: '$_id'
            }
        }
    ]).toArray();
    return result;
}

/**
 * Write a SQL statement to get the maximum purchase amount of all the orders.
 * | OrderID | Maximum Purchase Amount, $ |
 */
async function task_1_21(db) {
    const result = await db.collection('order-details').aggregate([
        {
            $group: {
                _id: '$OrderID',
                OrderID: {$first: '$OrderID'},
                'Maximum Purchase Amount, $': {
                  $sum: {$multiply: ['$UnitPrice', '$Quantity']}
                }
            }
        }, {$sort: {'Maximum Purchase Amount, $': -1}}, 
        {$limit: 1}, 
        {$project: {_id: 0}}
    ]).toArray();
    return result;
}

/**
 * Create a query to display the name of each customer along with their most expensive purchased product:
 * CustomerID | CompanyName | ProductName | PricePerItem |
 *
 * order by PricePerItem descending and them by CompanyName and ProductName acceding
 *
 * HINT: you can use pipeline inside of #lookup
 *       https://docs.mongodb.com/manual/reference/operator/aggregation/lookup/#join-conditions-and-uncorrelated-sub-queries
 */
async function task_1_22(db) {
    const result = await db.collection('orders').aggregate([
        {
            $lookup: {
                from: 'order-details',
                localField: 'OrderID',
                foreignField: 'OrderID',
                as: 'details'
            }
        }, {$unwind: '$details'}, 
        {$sort: {'details.UnitPrice': -1 }}, 
        {
            $group: {
                _id: '$CustomerID', 
                ProductID: {$first: '$details.ProductID'},
                UnitPrice: {$max: '$details.UnitPrice'}
            }
        }, {
            $lookup: {
                from: 'products',
                localField: 'ProductID',
                foreignField: 'ProductID',
                as: 'products'
            }
        }, {$unwind: '$products'}, 
        {
            $lookup: {
                from: 'customers',
                localField: '_id',
                foreignField: 'CustomerID',
                as: 'customers'
            }
        }, {$unwind: '$customers'}, 
        {
            $project: {
                _id: 0,
                CustomerID: '$_id',
                CompanyName: '$customers.CompanyName',
                ProductName: '$products.ProductName',
                PricePerItem: '$UnitPrice',
            }
        }, {
            $sort: {
                PricePerItem: -1,
                CompanyName: 1,
                ProductName: 1
            }
        }
    ]).toArray();
    return result;
}

module.exports = {
    before: before,
    task_1_1: task_1_1,
    task_1_2: task_1_2,
    task_1_3: task_1_3,
    task_1_4: task_1_4,
    task_1_5: task_1_5,
    task_1_6: task_1_6,
    task_1_7: task_1_7,
    task_1_8: task_1_8,
    task_1_9: task_1_9,
    task_1_10: task_1_10,
    task_1_11: task_1_11,
    task_1_12: task_1_12,
    task_1_13: task_1_13,
    task_1_14: task_1_14,
    task_1_15: task_1_15,
    task_1_16: task_1_16,
    task_1_17: task_1_17,
    task_1_18: task_1_18,
    task_1_19: task_1_19,
    task_1_20: task_1_20,
    task_1_21: task_1_21,
    task_1_22: task_1_22
};
