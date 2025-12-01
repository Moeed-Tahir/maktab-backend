const bcrypt = require("bcryptjs");
const Student = require("../models/Student");
const Parent = require("../models/Parent");
const User = require("../models/User");
const Class = require("../models/Class");
const Grade = require("../models/Grade");
const Attendance = require("../models/Attendance");
const Timetable = require("../models/TimeTable");
const Assignment = require("../models/Assignment");
const Payment = require("../models/Payments");

const mongoose = require("mongoose");

const createStudent = async (req, res) => {
  try {
    const {
      fullName,
      address,
      phone,
      spouse,
      spousePhone,
      emergencyPhone,
      addToWaitList: parentWaitList,
      email: parentEmail,
      password: parentPassword,
      identityNumber,

      studentName,
      studentPhone,
      studentAddress,
      addToWaitList: studentWaitList,
      dateOfBirth,
      gender,
      enrollDate,
      fee,
      studentEmail,
      studentPassword,
      class: studentClass,
    } = req.body;

    const existingStudent = await Student.findOne({ email: studentEmail });
    if (existingStudent) {
      return res.status(400).json({
        message: "Student with this email already exists."
      });
    }

    const classExists = await Class.findById(studentClass);
    if (!classExists) {
      return res.status(404).json({
        message: "Class not found."
      });
    }

    let parent = await Parent.findOne({ identityNumber });

    const hashedStudentPassword = await bcrypt.hash(studentPassword, 10);

    const studentUser = await User.create({
      email: studentEmail,
      password: hashedStudentPassword,
      role: "Student",
    });

    if (parent) {
      const student = await Student.create({
        studentName,
        phone: studentPhone,
        address: studentAddress,
        addToWaitList: studentWaitList,
        dateOfBirth,
        gender,
        enrollDate,
        fee,
        classes: studentClass,
        email: studentEmail,
        password: hashedStudentPassword,
        parent: parent._id,
        user: studentUser._id,
      });

      parent.students.push(student._id);
      await parent.save();

      return res.status(200).json({
        message: "Existing parent found. Linked new student.",
        parent,
        student,
        existingParent: true,
      });
    }

    // Create new parent and link
    const hashedParentPassword = await bcrypt.hash(parentPassword, 10);

    const parentUser = await User.create({
      email: parentEmail,
      password: hashedParentPassword,
      role: "Parent",
    });

    parent = await Parent.create({
      fullName,
      address,
      phone,
      spouse,
      spousePhone,
      emergencyPhone,
      addToWaitList: parentWaitList,
      email: parentEmail,
      password: hashedParentPassword,
      identityNumber,
      user: parentUser._id,
    });

    const student = await Student.create({
      studentName,
      phone: studentPhone,
      address: studentAddress,
      addToWaitList: studentWaitList,
      dateOfBirth,
      gender,
      enrollDate,
      fee,
      classes: studentClass,
      email: studentEmail,
      password: hashedStudentPassword,
      parent: parent._id,
      user: studentUser._id,
    });

    parent.students.push(student._id);
    await parent.save();

    return res.status(201).json({
      message: "New student and parent created successfully.",
      student,
      parent,
      existingParent: false,
    });
  } catch (error) {
    console.error("❌ Error creating student:", error);
    return res.status(500).json({ message: error.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.body;

    const student = await Student.findById(studentId).populate("parent").populate("user");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const parent = student.parent;
    const userId = student.user?._id;

    if (parent) {
      parent.students = parent.students.filter(
        studId => studId.toString() !== studentId
      );
      await parent.save();
    }

    await Payment.deleteMany({ student: studentId });

    await Student.findByIdAndDelete(studentId);

    if (userId) {
      await User.findByIdAndDelete(userId);
    }

    return res.status(200).json({
      message: "Student and all related data deleted successfully.",
      deletedStudentId: studentId
    });

  } catch (error) {
    console.error("Error deleting student:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

const getAllStudent = async (req, res) => {
  try {
    const {
      teacherId,
      search,
      page = 1,
      limit = 10
    } = req.body;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    let studentQuery = {};

    if (search) {
      studentQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'parent.name': { $regex: search, $options: 'i' } }
      ];
    }

    let students;
    let totalCount;

    if (teacherId) {
      // For teacher-specific students
      const studentsWithClasses = await Student.find(studentQuery)
        .populate({
          path: "classes",
          match: { teacherId: teacherId },
          populate: {
            path: "teacherId",
            select: "name email"
          }
        })
        .populate("parent");

      const filteredStudents = studentsWithClasses.filter(student =>
        student.classes && student.classes.length > 0
      );

      totalCount = filteredStudents.length;

      students = filteredStudents.slice(skip, skip + limitNumber);

    } else {
      totalCount = await Student.countDocuments(studentQuery);

      students = await Student.find(studentQuery)
        .populate("parent")
        .populate({
          path: "classes",
          populate: {
            path: "teacherId",
            select: "name email"
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber);
    }

    const totalPages = Math.ceil(totalCount / limitNumber);

    return res.status(200).json({
      message: teacherId ? "Teacher's students fetched successfully." : "All students fetched successfully.",
      students,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1
      }
    });
  } catch (error) {
    console.error("❌ Error fetching students:", error);
    return res.status(500).json({ message: error.message });
  }
};

const getAllWaitlistStudent = async (req, res) => {
  try {
    let { limit = 10, page = 1, search = "" } = req.body;

    limit = Number(limit) || 10;    
    page = Number(page) || 1;
    const skip = (page - 1) * limit;

    let searchFilter = {};
    if (search && search.trim() !== "") {
      const regex = new RegExp(search, "i"); 
      searchFilter = {
        $or: [
          { name: regex },
          { email: regex },
          { phone: regex }
        ]
      };
    }

    const query = {
      addToWaitList: true,
      ...searchFilter,
    };

    const waitlist = await Student.find(query)
      .populate("parent")
      .populate("class")
      .skip(skip)
      .limit(limit);

    const total = await Student.countDocuments(query);

    return res.status(200).json({
      message: "Waitlist students fetched successfully.",
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      waitlist,
    });

  } catch (error) {
    console.error("❌ Error fetching waitlisted students:", error);
    return res.status(500).json({ message: error.message });
  }
};


const addToWaitlist = async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        message: "studentId is required"
      });
    }

    const student = await Student.findByIdAndUpdate(
      studentId,
      { addToWaitList: true },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        message: "Student not found."
      });
    }

    return res.status(200).json({
      message: "Student added to waitlist.",
      student,
    });
  } catch (error) {
    console.error("❌ Error adding to waitlist:", error);
    return res.status(500).json({ message: error.message });
  }
};

const removeFromWaitlist = async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        message: "studentId is required"
      });
    }

    const student = await Student.findByIdAndUpdate(
      studentId,
      { addToWaitList: false },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        message: "Student not found."
      });
    }

    return res.status(200).json({
      message: "Student removed from waitlist.",
      student,
    });
  } catch (error) {
    console.error("❌ Error removing from waitlist:", error);
    return res.status(500).json({ message: error.message });
  }
};

const getStudentById = async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        message: "studentId is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        message: "Invalid student ID format"
      });
    }

    const studentData = await Student.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(studentId)
        }
      },
      {
        $lookup: {
          from: "parents",
          localField: "parent",
          foreignField: "_id",
          as: "parent"
        }
      },
      {
        $unwind: {
          path: "$parent",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "attendances",
          let: { studentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$$studentId", "$records.studentId"]
                }
              }
            },
            {
              $unwind: "$records"
            },
            {
              $match: {
                $expr: {
                  $eq: ["$records.studentId", "$$studentId"]
                }
              }
            },
            {
              $lookup: {
                from: "classes",
                localField: "classId",
                foreignField: "_id",
                as: "classInfo"
              }
            },
            {
              $lookup: {
                from: "teachers",
                localField: "teacherId",
                foreignField: "_id",
                as: "teacherInfo"
              }
            },
            {
              $project: {
                date: 1,
                status: "$records.status",
                remarks: "$records.remarks",
                className: { $arrayElemAt: ["$classInfo.name", 0] },
                teacherName: { $arrayElemAt: ["$teacherInfo.name", 0] }
              }
            },
            {
              $sort: { date: -1 }
            }
          ],
          as: "attendance"
        }
      },
      {
        $lookup: {
          from: "assessments",
          let: { studentClass: "$class" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$class", "$$studentClass"] },
                    { $eq: ["$type", "Assignment"] }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: "teachers",
                localField: "teacher",
                foreignField: "_id",
                as: "teacherInfo"
              }
            },
            {
              $lookup: {
                from: "classes",
                localField: "class",
                foreignField: "_id",
                as: "classInfo"
              }
            },
            {
              $project: {
                title: 1,
                description: 1,
                subject: 1,
                totalMarks: 1,
                dateAssigned: 1,
                dueDate: 1,
                attachments: 1,
                teacherName: { $arrayElemAt: ["$teacherInfo.name", 0] },
                className: { $arrayElemAt: ["$classInfo.name", 0] }
              }
            },
            {
              $sort: { dueDate: 1 }
            }
          ],
          as: "assignments"
        }
      },
      // Calculate attendance stats
      {
        $addFields: {
          attendanceStats: {
            $let: {
              vars: {
                attendanceRecords: "$attendance"
              },
              in: {
                total: { $size: "$$attendanceRecords" },
                present: {
                  $size: {
                    $filter: {
                      input: "$$attendanceRecords",
                      as: "record",
                      cond: { $eq: ["$$record.status", "Present"] }
                    }
                  }
                },
                absent: {
                  $size: {
                    $filter: {
                      input: "$$attendanceRecords",
                      as: "record",
                      cond: { $eq: ["$$record.status", "Absent"] }
                    }
                  }
                },
                late: {
                  $size: {
                    $filter: {
                      input: "$$attendanceRecords",
                      as: "record",
                      cond: { $eq: ["$$record.status", "Late"] }
                    }
                  }
                },
                excused: {
                  $size: {
                    $filter: {
                      input: "$$attendanceRecords",
                      as: "record",
                      cond: { $eq: ["$$record.status", "Excused"] }
                    }
                  }
                }
              }
            }
          }
        }
      },
      // Calculate percentage
      {
        $addFields: {
          "attendanceStats.percentage": {
            $cond: {
              if: { $gt: ["$attendanceStats.total", 0] },
              then: {
                $round: [
                  {
                    $multiply: [
                      {
                        $divide: [
                          "$attendanceStats.present",
                          "$attendanceStats.total"
                        ]
                      },
                      100
                    ]
                  },
                  0
                ]
              },
              else: 0
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: "$studentName",
          email: 1,
          phone: 1,
          dateOfBirth: 1,
          gender: 1,
          address: 1,
          class: 1,
          parent: {
            _id: 1,
            name: "$parent.fullName",
            email: "$parent.email",
            phone: "$parent.phone",
            spouse: "$parent.spouse",
            spousePhone: "$parent.spousePhone",
            emergencyPhone: "$parent.emergencyPhone",
            identityNumber: "$parent.identityNumber"
          },
          attendance: 1,
          assignments: 1,
          attendanceStats: 1,
          enrollDate: 1,
          fee: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);

    if (!studentData || studentData.length === 0) {
      return res.status(404).json({
        message: "Student not found."
      });
    }

    return res.status(200).json({
      message: "Student fetched successfully.",
      student: studentData[0]
    });
  } catch (error) {
    console.error("❌ Error fetching student by ID:", error);
    return res.status(500).json({ message: error.message });
  }
};

const updateStudentById = async (req, res) => {
  try {
    const { id, studentName, phone, address, classes, fee } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID format"
      });
    }

    const updateFields = {};

    if (studentName !== undefined) {
      updateFields.studentName = studentName.trim();
    }

    if (phone !== undefined) {
      updateFields.phone = phone;
    }

    if (address !== undefined) {
      updateFields.address = address;
    }

    if (classes !== undefined) {
      if (Array.isArray(classes)) {
        for (const classId of classes) {
          if (!mongoose.Types.ObjectId.isValid(classId)) {
            return res.status(400).json({
              success: false,
              message: `Invalid class ID format: ${classId}`
            });
          }
        }
        updateFields.classes = classes;
      } else {
        if (!mongoose.Types.ObjectId.isValid(classes)) {
          return res.status(400).json({
            success: false,
            message: "Invalid class ID format"
          });
        }
        updateFields.classes = [classes];
      }
    }

    if (fee !== undefined) {
      if (typeof fee !== 'number' || fee < 0) {
        return res.status(400).json({
          success: false,
          message: "Fee must be a positive number"
        });
      }
      updateFields.fee = fee;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update"
      });
    }

    const updatedStudent = await mongoose.model("Student").findByIdAndUpdate(
      id,
      { $set: updateFields },
      {
        new: true,
        runValidators: true
      }
    ).populate('classes', 'className');

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: updatedStudent
    });

  } catch (error) {
    console.error("Error updating student:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getStudentNamesWithIds = async (req, res) => {
  try {
    const students = await Student.find()
      .select('studentName _id')
      .sort({ studentName: 1 });

    const studentList = students.map(student => ({
      id: student._id,
      name: student.studentName
    }));

    return res.status(200).json({
      message: "Student names with IDs fetched successfully.",
      students: studentList,
      count: studentList.length
    });
  } catch (error) {
    console.error("❌ Error fetching student names:", error);
    return res.status(500).json({ message: error.message });
  }
};

const getStudentDashboardStats = async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: "Student ID is required" });
    }

    // Find student and populate classes and parent
    const student = await Student.findById(studentId)
      .populate("classes", "name subject")
      .populate("parent", "name email phone");

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Get the first class (since student can have multiple classes)
    const studentClass = student.classes && student.classes.length > 0 ? student.classes[0] : null;
    const classId = studentClass ? studentClass._id : null;

    const currentDate = new Date();
    const startOfToday = new Date(currentDate);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(currentDate);
    endOfToday.setHours(23, 59, 59, 999);

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayOfWeek = daysOfWeek[currentDate.getDay()];

    // Get today's timetable - using the first class
    const todaysTimetable = classId ? await Timetable.find({
      class: classId,
      dayOfWeek: currentDayOfWeek
    })
      .populate("teacher", "name")
      .sort({ startTime: 1 }) : [];

    const todaysClasses = todaysTimetable.length;

    // Get assignments due in next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const assignmentsDue = classId ? await Assignment.countDocuments({
      class: classId,
      dueDate: {
        $gte: startOfToday,
        $lte: sevenDaysFromNow
      }
    }) : 0;

    // Attendance calculations for current year
    const currentYear = currentDate.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    const attendanceRecords = await Attendance.find({
      "records.studentId": studentId,
      date: {
        $gte: startOfYear,
        $lte: endOfYear
      }
    });

    let totalDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;

    attendanceRecords.forEach(record => {
      const studentRecord = record.records.find(r =>
        r.studentId.toString() === studentId
      );
      if (studentRecord) {
        totalDays++;
        if (studentRecord.status === "Present") {
          presentDays++;
        } else if (studentRecord.status === "Absent") {
          absentDays++;
        } else if (studentRecord.status === "Late") {
          lateDays++;
        }
      }
    });

    const attendancePercentage = totalDays > 0
      ? Math.round((presentDays / totalDays) * 100)
      : 0;

    // Monthly attendance breakdown
    const monthlyAttendance = [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 12; i++) {
      const startOfMonth = new Date(currentYear, i, 1);
      const endOfMonth = new Date(currentYear, i + 1, 0);

      const monthAttendance = await Attendance.find({
        "records.studentId": studentId,
        date: { $gte: startOfMonth, $lte: endOfMonth }
      });

      let monthTotal = 0;
      let monthPresent = 0;
      let monthAbsent = 0;
      let monthLate = 0;

      monthAttendance.forEach(record => {
        const studentRecord = record.records.find(r =>
          r.studentId.toString() === studentId
        );
        if (studentRecord) {
          monthTotal++;
          if (studentRecord.status === "Present") {
            monthPresent++;
          } else if (studentRecord.status === "Absent") {
            monthAbsent++;
          } else if (studentRecord.status === "Late") {
            monthLate++;
          }
        }
      });

      const presentPercentage = monthTotal > 0
        ? Math.round((monthPresent / monthTotal) * 100)
        : 0;

      const absentPercentage = monthTotal > 0
        ? Math.round((monthAbsent / monthTotal) * 100)
        : 0;

      const latePercentage = monthTotal > 0
        ? Math.round((monthLate / monthTotal) * 100)
        : 0;

      monthlyAttendance.push({
        month: months[i],
        present: presentPercentage,
        absent: absentPercentage,
        late: latePercentage,
        actualPresent: monthPresent,
        actualAbsent: monthAbsent,
        actualLate: monthLate,
        total: monthTotal
      });
    }

    // Current month attendance
    const currentMonth = currentDate.getMonth();
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0);

    const currentMonthAttendance = await Attendance.find({
      "records.studentId": studentId,
      date: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth }
    });

    let currentMonthPresent = 0;
    let currentMonthAbsent = 0;
    let currentMonthLate = 0;
    let currentMonthTotal = 0;

    currentMonthAttendance.forEach(record => {
      const studentRecord = record.records.find(r =>
        r.studentId.toString() === studentId
      );
      if (studentRecord) {
        currentMonthTotal++;
        if (studentRecord.status === "Present") {
          currentMonthPresent++;
        } else if (studentRecord.status === "Absent") {
          currentMonthAbsent++;
        } else if (studentRecord.status === "Late") {
          currentMonthLate++;
        }
      }
    });

    const currentMonthPercentage = currentMonthTotal > 0
      ? Math.round((currentMonthPresent / currentMonthTotal) * 100)
      : 0;

    const studentAttendance = {
      studentId: studentId,
      studentName: student.studentName,
      className: studentClass ? studentClass.name : "Not Assigned",
      email: student.email,
      attendance: {
        present: currentMonthPresent,
        absent: currentMonthAbsent,
        late: currentMonthLate,
        total: currentMonthTotal,
        percentage: currentMonthPercentage
      },
      status: currentMonthPercentage >= 75 ? "Good" :
        currentMonthPercentage >= 50 ? "Average" : "Poor",
      yearlyStats: {
        present: presentDays,
        absent: absentDays,
        late: lateDays,
        total: totalDays,
        percentage: attendancePercentage
      }
    };

    // Upcoming exams/assignments
    const upcomingExams = classId ? await Assignment.countDocuments({
      class: classId,
      dueDate: { $gte: startOfToday }
    }) : 0;

    // ========== FIXED GPA CALCULATION SECTION ==========
    // Grades and GPA calculation based on Grade schema with assignment totalMarks
    const grades = await Grade.find({ student: studentId })
      .populate("assignment", "subject title totalMarks");

    let totalGPA = 0;
    let gradeCount = 0;
    let totalMarks = 0;
    let totalPossibleMarks = 0;
    let gradedAssignmentsCount = 0;

    // Grade point mapping
    const gradePointMap = {
      "A+": 4.0,
      "A": 4.0,
      "B+": 3.3,
      "B": 3.0,
      "C": 2.0,
      "D": 1.0,
      "F": 0.0
    };

    grades.forEach(grade => {
      const assignmentTotalMarks = grade.assignment?.totalMarks || 40;
      const percentage = (grade.marksObtained / assignmentTotalMarks) * 100;

      if (grade.grade && grade.grade in gradePointMap) {
        const gradePoints = gradePointMap[grade.grade];
        totalGPA += gradePoints;
        gradeCount++;
      } else {
        console.log(`✗ Grade "${grade.grade}" not found in gradePointMap or is undefined`);
      }

      if (grade.marksObtained !== undefined && grade.marksObtained !== null) {
        totalMarks += grade.marksObtained;
        totalPossibleMarks += assignmentTotalMarks;
        gradedAssignmentsCount++;
      }
    });


    const overallPercentage = totalPossibleMarks > 0
      ? (totalMarks / totalPossibleMarks * 100).toFixed(1)
      : "0.0";

    let currentGPA = "0.00";
    if (gradeCount > 0) {
      currentGPA = (totalGPA / gradeCount).toFixed(2);
    } else if (gradedAssignmentsCount > 0 && totalPossibleMarks > 0) {
      const percentageValue = parseFloat(overallPercentage);
      currentGPA = calculateGPAFromPercentage(percentageValue);
    }

    let currentGrade = "N/A";
    const gpaValue = parseFloat(currentGPA);

    if (gpaValue >= 3.7) currentGrade = "A+";
    else if (gpaValue >= 3.3) currentGrade = "A";
    else if (gpaValue >= 3.0) currentGrade = "B+";
    else if (gpaValue >= 2.7) currentGrade = "B";
    else if (gpaValue >= 2.3) currentGrade = "C+";
    else if (gpaValue >= 2.0) currentGrade = "C";
    else if (gpaValue >= 1.0) currentGrade = "D";
    else if (gpaValue >= 0.1) currentGrade = "F";
    else if (gpaValue === 0 && gradedAssignmentsCount > 0) currentGrade = "F";

    const subjectPerformance = [];
    if (classId) {
      try {
        const subjectGrades = await Grade.aggregate([
          {
            $lookup: {
              from: "assignments",
              localField: "assignment",
              foreignField: "_id",
              as: "assignmentInfo"
            }
          },
          {
            $unwind: "$assignmentInfo"
          },
          {
            $match: {
              student: new mongoose.Types.ObjectId(studentId),
              "assignmentInfo.class": new mongoose.Types.ObjectId(classId)
            }
          },
          {
            $group: {
              _id: "$assignmentInfo.subject",
              totalMarks: { $sum: "$assignmentInfo.totalMarks" },
              obtainedMarks: { $sum: "$marksObtained" },
              assignmentCount: { $sum: 1 },
              averageMarks: { $avg: "$marksObtained" }
            }
          },
          {
            $project: {
              subject: "$_id",
              percentage: {
                $cond: {
                  if: { $gt: ["$totalMarks", 0] },
                  then: { $multiply: [{ $divide: ["$obtainedMarks", "$totalMarks"] }, 100] },
                  else: 0
                }
              },
              averageScore: { $round: ["$averageMarks", 2] },
              assignmentCount: 1
            }
          },
          {
            $sort: { percentage: -1 }
          }
        ]);

        subjectPerformance.push(...subjectGrades);
      } catch (error) {
        console.error("Error in subject performance aggregation:", error);
      }
    }

    let classRank = "N/A";
    if (classId) {
      const classStudents = await Student.find({ classes: classId });
      const studentGPAs = await Grade.aggregate([
        {
          $lookup: {
            from: "assignments",
            localField: "assignment",
            foreignField: "_id",
            as: "assignmentInfo"
          }
        },
        {
          $unwind: "$assignmentInfo"
        },
        {
          $match: {
            student: { $in: classStudents.map(s => new mongoose.Types.ObjectId(s._id)) },
            "assignmentInfo.class": new mongoose.Types.ObjectId(classId)
          }
        },
        {
          $group: {
            _id: "$student",
            totalMarks: { $sum: "$assignmentInfo.totalMarks" },
            obtainedMarks: { $sum: "$marksObtained" },
            assignmentCount: { $sum: 1 }
          }
        },
        {
          $match: {
            assignmentCount: { $gte: 1 }
          }
        },
        {
          $project: {
            studentId: "$_id",
            percentage: {
              $cond: {
                if: { $gt: ["$totalMarks", 0] },
                then: { $multiply: [{ $divide: ["$obtainedMarks", "$totalMarks"] }, 100] },
                else: 0
              }
            },
            assignmentCount: 1
          }
        },
        {
          $sort: { percentage: -1 }
        }
      ]);

      const studentRankIndex = studentGPAs.findIndex(grade =>
        grade.studentId.toString() === studentId
      );

      if (studentRankIndex !== -1) {
        classRank = `${studentRankIndex + 1}${getOrdinalSuffix(studentRankIndex + 1)}`;
      }
    }

    const subjects = classId ? await Assignment.distinct("subject", {
      class: classId
    }) : [];

    const classSchedule = todaysTimetable.map(session => ({
      time: formatTime(session.startTime),
      subject: session.subject || "General",
      teacher: session.teacher ? session.teacher.name : "Teacher",
      room: "Classroom"
    }));

    let formattedTopStudents = [];
    if (classId) {
      const topStudents = await Grade.aggregate([
        {
          $lookup: {
            from: "students",
            localField: "student",
            foreignField: "_id",
            as: "studentInfo"
          }
        },
        {
          $unwind: "$studentInfo"
        },
        {
          $lookup: {
            from: "assignments",
            localField: "assignment",
            foreignField: "_id",
            as: "assignmentInfo"
          }
        },
        {
          $unwind: "$assignmentInfo"
        },
        {
          $match: {
            "studentInfo.classes": new mongoose.Types.ObjectId(classId),
            "assignmentInfo.class": new mongoose.Types.ObjectId(classId)
          }
        },
        {
          $group: {
            _id: "$student",
            totalMarks: { $sum: "$assignmentInfo.totalMarks" },
            obtainedMarks: { $sum: "$marksObtained" },
            studentName: { $first: "$studentInfo.studentName" },
            assignmentCount: { $sum: 1 }
          }
        },
        {
          $match: {
            assignmentCount: { $gte: 1 }
          }
        },
        {
          $project: {
            studentName: 1,
            percentage: {
              $cond: {
                if: { $gt: ["$totalMarks", 0] },
                then: { $multiply: [{ $divide: ["$obtainedMarks", "$totalMarks"] }, 100] },
                else: 0
              }
            },
            assignmentCount: 1
          }
        },
        {
          $sort: { percentage: -1 }
        },
        {
          $limit: 4
        }
      ]);

      formattedTopStudents = topStudents.map((stud, index) => ({
        rank: index + 1,
        name: stud.studentName,
        percentage: stud.percentage ? stud.percentage.toFixed(1) + "%" : "0%",
        gpa: stud.percentage ? calculateGPAFromPercentage(stud.percentage) : "0.00"
      }));
    }

    const assignmentsDueSoon = classId ? await Assignment.find({
      class: classId,
      dueDate: {
        $gte: startOfToday,
        $lte: sevenDaysFromNow
      }
    }).populate("teacher", "name")
      .sort({ dueDate: 1 })
      .limit(4) : [];

    const formattedAssignments = assignmentsDueSoon.map(assignment => ({
      subject: assignment.subject,
      assignment: assignment.title,
      date: new Date(assignment.dueDate).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      isUrgent: new Date(assignment.dueDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Within 3 days
    }));

    const dashboardData = {
      keyMetrics: {
        todaysClasses,
        assignmentsDue,
        attendancePercentage,
        upcomingExams
      },

      monthlyAttendance,

      studentAttendance,

      academicPerformance: {
        currentGrade,
        classRank,
        totalSubjects: subjects.length,
        gpa: currentGPA,
        overallPercentage: overallPercentage + "%",
        totalGradedAssignments: gradedAssignmentsCount,
        subjectPerformance
      },

      classSchedule,

      topStudents: formattedTopStudents,

      assignmentsDueSoon: formattedAssignments,

      studentInfo: {
        name: student.studentName,
        class: studentClass ? studentClass.name : "Not Assigned",
        email: student.email,
        parent: student.parent
      }
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error("Error fetching student dashboard stats:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
};

function calculateGPAFromPercentage(percentage) {
  if (percentage >= 97) return "4.00";
  else if (percentage >= 93) return "4.00";
  else if (percentage >= 90) return "3.70";
  else if (percentage >= 87) return "3.30";
  else if (percentage >= 83) return "3.00";
  else if (percentage >= 80) return "2.70";
  else if (percentage >= 77) return "2.30";
  else if (percentage >= 73) return "2.00";
  else if (percentage >= 70) return "1.70";
  else if (percentage >= 67) return "1.30";
  else if (percentage >= 65) return "1.00";
  else if (percentage >= 60) return "0.70";
  else if (percentage >= 50) return "0.50";
  else if (percentage >= 40) return "0.30";
  else if (percentage >= 30) return "0.10";
  else return "0.00";
}

function getOrdinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatTime(timeString) {
  if (!timeString) return "";
  const time = new Date(`2000-01-01T${timeString}`);
  return time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

module.exports = {
  createStudent,
  getAllStudent,
  getAllWaitlistStudent,
  addToWaitlist,
  removeFromWaitlist,
  getStudentById,
  getStudentNamesWithIds,
  getStudentDashboardStats,
  updateStudentById,
  deleteStudent
};