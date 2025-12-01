const Payment = require("../models/Payments");

const getAllPaymentStats = async (req, res) => {
  try {
    const { 
      year = new Date().getFullYear().toString(),
      status,
      page = 1,
      limit = 10,
      search,
      startDate,
      endDate
    } = req.body;

    const baseQuery = {};
    
    if (startDate && endDate) {
      baseQuery.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (year) {
      const yearStart = new Date(`${year}-01-01`);
      const yearEnd = new Date(`${year}-12-31`);
      yearEnd.setHours(23, 59, 59, 999);
      
      baseQuery.paymentDate = {
        $gte: yearStart,
        $lte: yearEnd
      };
    }

    if (status && status !== 'all') {
      baseQuery.status = status;
    }

    if (search) {
      baseQuery.invoiceNumber = { $regex: search, $options: 'i' };
    }

    const totalStats = await Payment.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          averagePayment: { $avg: "$amount" },
          lastPaymentDate: { $max: "$paymentDate" }
        }
      }
    ]);

    const paymentMethodsStats = await Payment.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            $cond: [
              { $and: [
                "$paymentMethod.paymentMethodId",
                { $ne: ["$paymentMethod.paymentMethodId", null] }
              ]},
              "CARD",
              "CARD" 
            ]
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        }
      }
    ]);

    const totalPayments = totalStats[0]?.totalPayments || 0;
    
    const cardBrandsStats = await Payment.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$paymentMethod.cardBrand",
          count: { $sum: 1 }
        }
      }
    ]);

    const paymentMethodsDistribution = {
      CARD: 0,
      CASH: 0,
      STRIPE: 0,
      ZELLE: 0
    };

    if (totalPayments > 0) {
      const visaPayments = cardBrandsStats.find(stat => stat._id === "visa")?.count || 0;
      const mastercardPayments = cardBrandsStats.find(stat => stat._id === "mastercard")?.count || 0;
      const amexPayments = cardBrandsStats.find(stat => stat._id === "amex")?.count || 0;
      const discoverPayments = cardBrandsStats.find(stat => stat._id === "discover")?.count || 0;
      const otherCards = totalPayments - (visaPayments + mastercardPayments + amexPayments + discoverPayments);

      paymentMethodsDistribution.CARD = Math.round((visaPayments / totalPayments) * 100) || 25;
      paymentMethodsDistribution.CASH = Math.round((mastercardPayments / totalPayments) * 100) || 25;
      paymentMethodsDistribution.STRIPE = Math.round((amexPayments / totalPayments) * 100) || 25;
      paymentMethodsDistribution.ZELLE = Math.round((otherCards / totalPayments) * 100) || 25;
    } else {
      paymentMethodsDistribution.CARD = 25;
      paymentMethodsDistribution.CASH = 25;
      paymentMethodsDistribution.STRIPE = 25;
      paymentMethodsDistribution.ZELLE = 25;
    }

    const monthlyTrends = await Payment.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: { $month: "$paymentDate" },
          totalAmount: { $sum: "$amount" },
          paymentCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const monthlyTrendsData = Array(12).fill(0).map((_, index) => {
      const monthData = monthlyTrends.find(trend => trend._id === index + 1);
      return monthData ? Math.round(monthData.totalAmount / 1000) : 0;
    });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const paymentRecords = await Payment.find(baseQuery)
      .populate('parent', 'fullName email')
      .populate('student', 'studentName')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const formattedRecords = paymentRecords.map(payment => ({
      id: payment._id.toString(),
      receiptNumber: payment.invoiceNumber,
      paymentDate: new Date(payment.paymentDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      paymentAmount: `$${payment.amount.toFixed(2)}`,
      paymentMethod: payment.paymentMethod?.cardBrand ? 
        `${payment.paymentMethod.cardBrand.toUpperCase()} •••• ${payment.paymentMethod.last4}` : 
        'CARD',
      status: payment.status,
      parentName: payment.parent?.fullName || 'N/A',
      studentName: payment.student?.studentName || 'N/A'
    }));

    const totalRecords = await Payment.countDocuments(baseQuery);

    const stats = totalStats[0] || {
      totalPayments: 0,
      totalAmount: 0,
      averagePayment: 0,
      lastPaymentDate: null
    };

    const responseData = {
      totalPayments: stats.totalPayments,
      totalAmount: stats.totalAmount.toFixed(2),
      averagePayment: Math.round(stats.averagePayment || 0),
      lastPaymentDate: stats.lastPaymentDate ? 
        new Date(stats.lastPaymentDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).replace(/\//g, '-') : 
        'No payments',

      paymentMethodsData: {
        labels: ["CARD", "CASH", "STRIPE", "ZELLE"],
        datasets: [{
          data: [
            paymentMethodsDistribution.CARD,
            paymentMethodsDistribution.CASH,
            paymentMethodsDistribution.STRIPE,
            paymentMethodsDistribution.ZELLE
          ],
          backgroundColor: ["#14B8A6", "#0B4B31", "#3B82F6", "#000000"],
          borderWidth: 0,
        }]
      },

      monthlyTrendsData: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        datasets: [{
          label: "Payments",
          data: monthlyTrendsData,
          backgroundColor: [
            "#0B4B31", "#14B8A6", "#000000", "#3B82F6", "#3B82F6", "#14B8A6",
            "#0B4B31", "#14B8A6", "#000000", "#3B82F6", "#3B82F6", "#14B8A6"
          ],
          borderWidth: 0,
        }]
      },

      // Table Data
      tableData: formattedRecords,
      
      // Pagination Info
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRecords / parseInt(limit)),
        totalRecords,
        hasNext: (parseInt(page) * parseInt(limit)) < totalRecords,
        hasPrev: parseInt(page) > 1
      }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Error fetching payment stats:', error);
    return res.status(500).json({
      message: 'Failed to fetch payment statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllPaymentStats
};