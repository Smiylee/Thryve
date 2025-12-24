import express from 'express'
import bcrypt from 'bcryptjs'
import {PrismaClient} from '@prisma/client'
const router  = express.Router()
const prisma = new PrismaClient()

router.get("/signup",(req,res)=> {
    res.render('signup',{error: ""})
})


router.post('/signup/admin', async (req,res)=> {
    const {username, password, cpassword, adminCode} = req.body;
    username.trim();
  const usernameString = String(username.trim()); // Trim and assign back to usernameString
  const adminCodeText = String(adminCode);
  
  const adminCodes = ["123245","448952","123391","4378023","4382334","2009","99832"];
  const isValid = adminCodes.includes(adminCodeText);
  const isPasswordValid = password === cpassword;
  
  // Validate username is not empty
  if (!usernameString) {
    return res.render("signup", { error: "Username cannot be empty" });
  }
  
  if(!isValid) {
    res.render("signup",{error: "Invalid Admin Code"})
  } else {
    if (!isPasswordValid) {
      res.render("signup",{error: "Passwords Do not match"})
    } else {
         const hashedPassword = await bcrypt.hash(password, 10);
        try {
          await prisma.admin.create({
            data: {
              username: usernameString,
              password: hashedPassword,
              adminCode: adminCodeText
            }
          })
          res.redirect('/auth/login/admin'); // Redirect to a success page or render a success message
        } catch (error) {
          res.render("signup", { error: "Error creating admin: " + error.message });
        }
       }
    }
  })

  export default router 

  
     
