const Parent = require("../models/Parent");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payments");
const User = require("../models/User");

const getDashboardStats = async (req, res) => {
    try {
        const { year = new Date().getFullYear() } = req.body;
        const parsedYear = parseInt(year);

        const totalParents = await Parent.countDocuments();
        const totalStudents = await Student.countDocuments();
        const totalTeachers = await Teacher.countDocuments();
        const totalInvoices = await Invoice.countDocuments();

        // Total admins
        const totalAdmins = await User.countDocuments({ role: { $in: ["Super Admin", "Admin", "SubAdmin"] } });

        const totalPaidAgg = await Payment.aggregate([
            { $match: { status: "succeeded" } },
            { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
        ]);
        const totalPaidAmount = totalPaidAgg[0]?.totalPaid || 0;

        const unpaidAgg = await Invoice.aggregate([
            { $match: { status: { $ne: "paid" } } },
            { $group: { _id: null, totalUnpaid: { $sum: { $subtract: ["$totalAmount", "$paidAmount"] } } } },
        ]);
        const totalUnpaidAmount = unpaidAgg[0]?.totalUnpaid || 0;

        const monthlyPaymentsRaw = await Payment.aggregate([
            {
                $match: {
                    status: "succeeded",
                    paymentDate: {
                        $gte: new Date(`${parsedYear}-01-01`),
                        $lte: new Date(`${parsedYear}-12-31`),
                    },
                },
            },
            {
                $group: {
                    _id: { $month: "$paymentDate" },
                    totalPaid: { $sum: "$amount" },
                },
            },
            { $sort: { "_id": 1 } },
        ]);

        const months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];

        const totalYearlyPaid = monthlyPaymentsRaw.reduce(
            (sum, m) => sum + m.totalPaid,
            0
        ) || 1;

        const yearlyPayments = months.map((month, idx) => {
            const monthData = monthlyPaymentsRaw.find(m => m._id === idx + 1);
            const paid = monthData?.totalPaid || 0;
            const percentage = (paid / totalYearlyPaid) * 100;

            return {
                month,
                value: parseFloat(percentage.toFixed(2)),
                totalPaid: paid
            };
        });

        const today = new Date();
        const currentMonth = today.getMonth() + 1; 
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;

        const currentMonthIncome = monthlyPaymentsRaw.find(m => m._id === currentMonth)?.totalPaid || 0;
        const lastMonthIncome = monthlyPaymentsRaw.find(m => m._id === lastMonth)?.totalPaid || 0;

        const topPayingParents = await Payment.aggregate([
            {
                $group: {
                    _id: "$parent",
                    totalPaid: { $sum: "$amount" },
                    lastPaymentDate: { $max: "$paymentDate" },
                },
            },
            { $sort: { totalPaid: -1 } },
            { $limit: 4 },
            {
                $lookup: {
                    from: "parents",
                    localField: "_id",
                    foreignField: "_id",
                    as: "parent",
                },
            },
            { $unwind: "$parent" },
            {
                $project: {
                    name: "$parent.fullName",
                    date: "$lastPaymentDate",
                    amount: "$totalPaid",
                },
            },
        ]);

        const topOutstandingParents = await Invoice.aggregate([
            {
                $group: {
                    _id: "$parent",
                    unpaid: { $sum: { $subtract: ["$totalAmount", "$paidAmount"] } },
                    lastInvoice: { $max: "$createdAt" },
                },
            },
            { $sort: { unpaid: -1 } },
            { $limit: 4 },
            {
                $lookup: {
                    from: "parents",
                    localField: "_id",
                    foreignField: "_id",
                    as: "parent",
                },
            },
            { $unwind: "$parent" },
            {
                $project: {
                    name: "$parent.fullName",
                    date: "$lastInvoice",
                    amount: "$unpaid",
                },
            },
        ]);

        return res.status(200).json({
            success: true,
            stats: {
                totalParents,
                totalStudents,
                totalTeachers,
                totalInvoices,
                totalAdmins, // <-- Added here
                totalPaidAmount,
                totalUnpaidAmount,
                paidPercentage:
                    totalPaidAmount &&
                    ((totalPaidAmount / (totalPaidAmount + totalUnpaidAmount)) * 100).toFixed(2),
                unpaidPercentage:
                    totalUnpaidAmount &&
                    ((totalUnpaidAmount / (totalPaidAmount + totalUnpaidAmount)) * 100).toFixed(2),
                lastMonthIncome,
                currentMonthIncome
            },
            yearlyPayments,
            topPayingParents,
            topOutstandingParents,
        });
    } catch (error) {
        console.error("Dashboard Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

module.exports = {
    getDashboardStats
};