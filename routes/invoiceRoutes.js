const express = require("express");
const router = express.Router();
const { createInvoice, getAllInvoices, getInvoicesStats,getInvoiceById,updateInvoice } = require("../controllers/InvoiceController");

router.post("/createInvoice", createInvoice);
router.post("/getAllInvoices", getAllInvoices);
router.post("/getInvoicesStats", getInvoicesStats);
router.post("/getInvoiceById", getInvoiceById);
router.post("/updateInvoice", updateInvoice);

module.exports = router;
