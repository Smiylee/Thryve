import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import SQLiteStoreFactory from "connect-sqlite3";

const prisma = new PrismaClient();

const PORT = 3000;
const app = express();

// const SQLiteStore = SQLiteStoreFactory(express.session);
import session from "express-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname + '/public'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


import loginRoutes from "./routes/login.js"
import signupRoutes from "./routes/signup.js"
import { error } from 'console';
// import adminRoutes from "./routes/admin.js"


// app.use(
//   session({
//    store: new SQLiteStore({ db: "sessions.sqlite", dir: "." }),
//     secret: "939a41a93d5b32936dce8307489b26231133c17bf4872c32c8c941122f61b73a5ab4991c581a57aa10a973d868ce843470ec37e46a596e5d4985385408d0a3f9", 
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       maxAge: 1000 * 60 * 60 * 24, 
//       sameSite: "lax", 
//     },
//   })
// );


app.use(session({
    secret: "939a41a93d5b32936dce8307489b26231133c17bf4872c32c8c941122f61b73a5ab4991c581a57aa10a973d868ce843470ec37e46a596e5d4985385408d0a3f9", 
    resave: false,            
    saveUninitialized: true,  // save new sessions
    cookie: { 
      maxAge: 1000 * 60 * 60 * 24, 
      sameSite: "lax",
      secure: false 
    } 
}));


app.use("/auth",loginRoutes)
app.use("/",signupRoutes)

// app.use("/admin",adminRoutes)

app.get("/",(req,res)=> {
  res.render("index",{})
})


// app.get("/login", (req, res) => {
  //     res.sendFile(path.join(__dirname, 'views', 'login.html'));
  // });
  
  app.get("/dashboard", (req, res) => {
  res.render('dashboard', {});
});

  app.get("/admin/dashboard", async (req, res) => {
if (req.session.admin){
 
     const mostFrequentSickness = await prisma.complaint.groupBy({
      by: ["complaintIdent"],
      _count: {
        complaintIdent: true
      },
      orderBy: {
        _count: {
          complaintIdent: "desc"
        }
      },
      take: 1
    });


  res.render('admin-dashboard', {admin: req.session.admin,mostFrequentSickness: mostFrequentSickness[0] || null });
} else {
  res.redirect("/auth/login/admin")
}



});


app.get("/admin/nurses", async (req,res)=> {
  const nurses = await prisma.nurse.findMany();
    res.render("nurses",{error: "", nurses})
})

app.get("/admin/add/nurse", (req,res) => {
    res.render("add-nurse",{error: ""})
})








app.post("/admin/add/nurse",  async (req,res)=> {
    const {name,email,password,confirmPassword,phoneNumber} = req.body;
 
    if(password !== confirmPassword){
        return res.render("add-nurse", {error: "Passwords do not match"})
    }
    try {
        await prisma.nurse.create({
            data: {
                name,
                email,
                password,
                phone: phoneNumber,
                admin: {
                    connect: { id: 1 }
                }
            }
        })
        res.redirect("/admin/nurses")
    } catch (error) {
        res.render("add-nurse", {error})
    }
   
})



app.get("/admin/analytics", async (req,res) => {

const mostCommonSicknesses = await prisma.sickness.findMany({
  include: {
    _count: {
      select: {
        complaints: true
      }
    }
  },
  orderBy: {
    complaints: {
      _count: 'desc'
    }
  },
  take: 1
})

console.log(mostCommonSicknesses)
// const sicknessStats = await prisma.sickness.findMany({
//   include: {
//     complaints: {
//       where: {
//         createdAt: {
//           gte: new Date("2025-12-01"),
//           lt:  new Date("2026-01-01")
//         }
//       }
//     },
//     _count: {
//       select: { complaints: true }
//     }
//   }
// });

  res.render("analytics",{mostCommonSicknesses})
})

app.get("/admin/record-books", (req,res) => {
  res.render("record-books",{})
})













app.get("/admin/shifts", async (req,res) => {
  try {

    const shifts = await prisma.shift.findMany({})
    res.render("shifts",{shifts, error: ""})
  } catch(err) {
    res.render("shifts",{shifts: [], error: err.message})
  }
})


app.get("/student/records", async (req,res) => {
const students = await prisma.student.findMany();

  res.render('student_records', {students, error:""});
})

app.get("/add/student" , (req,res) => {
  res.render("add_student",{error:""})
})

app.post("/add/student", async (req,res) => {
  try {
    const {name,height,weight} = req.body;
   const sClass = req.body.class;
   const sAge  = Number.parseInt(req.body.age)
   await prisma.student.create({
    data: {
      name,
      height: Number.parseFloat(height),
      weight: Number.parseFloat(weight),
      age: sAge,
      class: sClass
    }
   })
    res.redirect("/student/records")
  } catch(err) {
res.render("add_student",{error: err.message})
  }
  
})

app.get("/student/view/:id", async (req,res) => {



  const studentId = parseInt(req.params.id);
  const student = await prisma.student.findUnique({
    where: { id: studentId }
  })

  const complaints = await prisma.complaint.findMany({
    where : {studentId: studentId},
    include: {
      sicknesses: true
    },
    orderBy: {started: 'desc'}
  })

   console.log(complaints)

  res.render("view_student",{student,nurseId: req.session.nurse ? req.session.nurse.id : null, complaints})

})


app.post('/student/add/complaint/:id',async (req,res) => {
  const studentId = Number(req.body.studentId);
  // const nurse = req.session.nurse
  const nurseId = Number(req.body.nurseId);
  const student = await prisma.student.findFirst({
    where: {id: Number(studentId)}
  })


  const nurse = await prisma.nurse.findFirst({
    where: {id: Number(nurseId)}
  })
  const {complaintIdent,complaintNotes,medication,tags} = req.body
  const frequency = Number(req.body.frequency);
  const duration = Number(req.body.duration);
  
   
   
   

  const severity  = req.body.severity
  console.log(nurseId, studentId, tags, medication, complaintNotes, severity, frequency, duration)

   let sicknesses = [];
   
    sicknesses = JSON.parse(tags);
  console.log(sicknesses)
  await prisma.complaint.create({
    data : {
        complaintIdent,
        complaintNotes,
        medication,
        severity,
        studentName: student.name,
        nurseName: nurse.name,
        sicknesses: {
            connectOrCreate : sicknesses.map((name) => ({
              where:{name},
              create: {name}
            }))
      
        },
        frequency,
        duration,
        student: {connect: {id: studentId} },
        nurse: {connect: {id: nurseId} },
        started: new Date(),
        ended: null

    }
  })
  const complaint = await prisma.complaint.findFirst({
    where: { studentId: studentId },
    orderBy: { started: 'desc' }
  })
  await prisma.student.update({
    where : {id :studentId},
    data : {
      complaints: {connect: {id: complaint.id}}
    }
  })
  res.redirect(`/student/view/${studentId}`);

})

app.get("/student/complaints", async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({
        orderBy: {started: 'desc'},
        take:20
      })
      res.render('complaints', {complaints, error: ""});
  } catch(err) {
    return res.render('complaints', {error: err.message});
  }

});

app.get("/health-tracking",(req,res)=>{
  res.render("health-tracking",{})
})
app.get('/appointments',(req,res) => {
   res.render("appointments")
})
app.get('/medications',(req,res) => {
   res.render("medications")
})


app.get('/records',(req,res) => {
   res.render("records")
})


app.post("/auth/logout/nurse", async (req,res) => {
    try {
        const name = req.session.nurse.name
        const user = await prisma.nurse.findFirst({where: req.body.userId ? {id: parseInt(req.body.userId)} : {name} })
        const shift = await prisma.shift.findFirst({
            where: {
                nurseId: user.id,
                endTime: null
            },
            orderBy: {startTime: 'desc'}
        })
        if (shift) {
            await prisma.shift.update({
                where: {id: shift.id},
                data: {endTime: new Date()}
            })
        }
   req.session.destroy((err) => {
    if (err) return res.status(500).send("Could not destroy session");
    res.clearCookie('connect.sid');
    res.redirect('/');
   })
        // res.redirect("/");
    } catch(err) {
        const name = req.session.nurse.name
        const user = await prisma.nurse.findFirst({where: req.body.userId ? {id: parseInt(req.body.userId)} : {name} })
        res.status(500).render("nurse-dashboard",{user, error: err.message})
    }
})

app.get("/student/view/complaint/:id", async (req,res) => {
if (req.session.nurse || req.session.admin) {
  const complaintId = parseInt(req.params.id);
  const complaint = await prisma.complaint.findUnique({
    where: {id: complaintId}
  })

  res.render("view_complaints",{complaint})
} else {
  res.redirect("/auth/login/nurse")
}
})


 app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    })
