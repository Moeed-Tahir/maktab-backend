const Invoice = require("../models/Invoice");
const Parent = require("../models/Parent");
const Student = require("../models/Student");
const NotificationService = require("../services/NotificationServices");

const getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.body;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const searchQuery = search ? {
      $or: [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { "parent.fullName": { $regex: search, $options: "i" } },
        { "parent.email": { $regex: search, $options: "i" } },
        { "student.studentName": { $regex: search, $options: "i" } },
        { "student.email": { $regex: search, $options: "i" } }
      ]
    } : {};

    const statusFilter = status ? { status } : {};

    const filterQuery = {
      ...searchQuery,
      ...statusFilter
    };

    const total = await Invoice.countDocuments(filterQuery);

    const invoices = await Invoice.find(filterQuery)
      .populate({
        path: "parent",
        select: "fullName email phone",
      })
      .populate({
        path: "student",
        select: "studentName email",
      })
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      }
    });

  } catch (error) {
    console.error("Error fetching invoices:", error);
    return res.status(500).json({
      success: false,
      message: `Invoice fetch error: ${error.message}`,
    });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.body;

    const invoice = await Invoice.findById(id)
      .populate({
        path: "parent",
        select: "fullName email phone",
      })
      .populate({
        path: "student",
        select: "studentName email",
      });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: invoice,
    });

  } catch (error) {
    console.error("Error fetching invoice:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID format",
      });
    }

    return res.status(500).json({
      success: false,
      message: `Invoice fetch error: ${error.message}`,
    });
  }
};

const getInvoicesStats = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      fromDate,
      toDate,
      status,
      unpaidPage = 1,
      unpaidLimit = 10,
      unpaidSearch = "",
      unpaidStatus,
      date,
      filterBy
    } = req.body;

    page = Number(page);
    limit = Number(limit);
    unpaidPage = Number(unpaidPage);
    unpaidLimit = Number(unpaidLimit);

    // MAIN FILTER
    const filter = {};

    // --- DATE FILTERS ---
    if (date) {
      filter.createdAt = {};
      const now = new Date();

      if (date === "this_month") {
        filter.createdAt.$gte = new Date(now.getFullYear(), now.getMonth(), 1);
        filter.createdAt.$lte = now;
      } else if (date === "last_month") {
        filter.createdAt.$gte = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        filter.createdAt.$lte = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (date === "this_year") {
        filter.createdAt.$gte = new Date(now.getFullYear(), 0, 1);
        filter.createdAt.$lte = now;
      }
    }

    if (fromDate || toDate) {
      filter.createdAt = filter.createdAt || {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    // ---- STATUS FILTER ----
    if (status) {
      if (status === "paid") filter.status = "paid";
      if (status === "unpaid") filter.status = { $in: ["pending", "overdue"] };
    }

    // ---- MAIN SEARCH FILTER ----
    if (search.trim() !== "") {
      const matchingParents = await Parent.find({
        fullName: { $regex: search, $options: "i" }
      }).select("_id");

      const matchingStudents = await Student.find({
        studentName: { $regex: search, $options: "i" }
      }).select("_id");

      filter.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { parent: { $in: matchingParents.map(p => p._id) } },
        { student: { $in: matchingStudents.map(s => s._id) } }
      ];
    }

    // ---- FETCH ALL INVOICES FOR STATS ----
    const allInvoices = await Invoice.find(filter)
      .populate({ path: "parent", select: "fullName email phone" })
      .populate({ path: "student", select: "studentName email" });

    // ---- STATS ----
    const totalAmount = allInvoices.reduce((s, inv) => s + inv.totalAmount, 0);
    const totalPaidAmount = allInvoices.reduce((s, inv) => s + inv.paidAmount, 0);
    const totalUnpaidAmount = totalAmount - totalPaidAmount;

    const monthlyData = {
      paid: Array(12).fill(0),
      unpaid: Array(12).fill(0)
    };

    allInvoices.forEach(inv => {
      const month = new Date(inv.createdAt).getMonth();
      if (inv.status === "paid") {
        monthlyData.paid[month] += inv.paidAmount;
      } else {
        monthlyData.unpaid[month] += (inv.totalAmount - inv.paidAmount);
      }
    });

    // ---- PAYMENT METHOD STATS (Placeholder) ----
    const paymentMethods = {
      stripe: allInvoices.filter(inv => inv.paidAmount > 0).length * 0.7,
      other: allInvoices.filter(inv => inv.paidAmount > 0).length * 0.3
    };

    const unpaidFilter = {
      ...filter,
      $or: [
        { status: "pending" },
        { status: "overdue" },
        {
          // partially paid
          $expr: {
            $and: [
              { $gt: ["$paidAmount", 0] },
              { $lt: ["$paidAmount", "$totalAmount"] }
            ]
          }
        }
      ]
    };

    if (unpaidSearch.trim() !== "") {
      const matchingParents = await Parent.find({
        $or: [
          { fullName: { $regex: unpaidSearch, $options: "i" } },
          { phone: { $regex: unpaidSearch, $options: "i" } }
        ]
      }).select("_id");

      unpaidFilter.$or.push(
        { invoiceNumber: { $regex: unpaidSearch, $options: "i" } },
        { parent: { $in: matchingParents.map(p => p._id) } }
      );
    }

    if (unpaidStatus) {
      delete unpaidFilter.status;
      delete unpaidFilter.$or;

      if (unpaidStatus === "pending") {
        unpaidFilter.status = "pending";
      } else if (unpaidStatus === "overdue") {
        unpaidFilter.status = "overdue";
      } else if (unpaidStatus === "partially_paid") {
        unpaidFilter.$expr = {
          $and: [
            { $gt: ["$paidAmount", 0] },
            { $lt: ["$paidAmount", "$totalAmount"] }
          ]
        };
      }
    }

    const unpaidInvoices = await Invoice.find(unpaidFilter)
      .populate({ path: "parent", select: "fullName email phone" })
      .populate({ path: "student", select: "studentName email" })
      .sort({ createdAt: -1 })
      .skip((unpaidPage - 1) * unpaidLimit)
      .limit(unpaidLimit);

    const totalUnpaidInvoicesCount = await Invoice.countDocuments(unpaidFilter);

    const invoices = await Invoice.find(filter)
      .populate({ path: "parent", select: "fullName email phone" })
      .populate({ path: "student", select: "studentName email" })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalInvoicesCount = await Invoice.countDocuments(filter);

    const formatInvoices = (arr) =>
      arr.map((inv) => ({
        ...inv.toObject(),
        items: inv.items.map(item => ({
          ...item,
          amount: item.amount
        }))
      }));

    return res.status(200).json({
      success: true,
      stats: {
        totalInvoices: allInvoices.length,
        totalAmount,
        totalPaidAmount,
        totalUnpaidAmount,
        monthlyPaid: monthlyData.paid,
        monthlyUnpaid: monthlyData.unpaid,
        stripePayments: paymentMethods.stripe,
        otherPayments: paymentMethods.other
      },
      unpaidInvoices: formatInvoices(unpaidInvoices),
      unpaidPagination: {
        page: unpaidPage,
        limit: unpaidLimit,
        totalUnpaidCount: totalUnpaidInvoicesCount,
        totalUnpaidPages: Math.ceil(totalUnpaidInvoicesCount / unpaidLimit),
      },
      pagination: {
        page,
        limit,
        totalInvoicesCount,
        totalPages: Math.ceil(totalInvoicesCount / limit),
      },
      invoices: formatInvoices(invoices)
    });
  } catch (error) {
    console.error("Error fetching invoice stats:", error);
    return res.status(500).json({
      success: false,
      message: `Invoice stats error: ${error.message}`,
    });
  }
};

const createInvoice = async (req, res) => {
  try {
    const {
      parentId,
      studentId,
      items,
      totalAmount,
      dueDate,
      notes
    } = req.body;

    const invoice = new Invoice({
      parent: parentId,
      student: studentId,
      invoiceNumber: `INV-${Date.now()}`,
      items,
      totalAmount,
      dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes
    });

    await invoice.save();

    try {
      const parent = await Parent.findById(parentId);
      if (parent) {
        await NotificationService.sendInvoiceNotification(invoice, parent);
        console.log("Invoice notification sent to parent");
      }
    } catch (notificationError) {
      console.error("Failed to send invoice notification:", notificationError);
    }

    return res.status(201).json({
      message: "Invoice created successfully",
      invoice,
    });

  } catch (error) {
    console.error("Error creating invoice:", error);

    return res.status(500).json({
      message: error.message || "Failed to create invoice",
    });
  }
};

const updateInvoice = async (req, res) => {
  try {

    const {
      parentId,
      studentId,
      items,
      totalAmount,
      paidAmount,
      dueDate,
      status,
      notes,
      id
    } = req.body;

    const existingInvoice = await Invoice.findById(id);
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const updateData = {};
    
    if (parentId) updateData.parent = parentId;
    if (studentId) updateData.student = studentId;
    if (items) updateData.items = items;
    if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
    if (paidAmount !== undefined) updateData.paidAmount = paidAmount;
    if (dueDate) updateData.dueDate = dueDate;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true,
        runValidators: true 
      }
    ).populate({
      path: "parent",
      select: "fullName email phone",
    }).populate({
      path: "student",
      select: "studentName email",
    });

    return res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      data: updatedInvoice,
    });

  } catch (error) {
    console.error("Error updating invoice:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID format",
      });
    }

    return res.status(500).json({
      success: false,
      message: `Invoice update error: ${error.message}`,
    });
  }
};

module.exports = {
  getAllInvoices,
  getInvoiceById,
  getInvoicesStats,
  createInvoice,
  updateInvoice
};