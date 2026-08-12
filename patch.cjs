const fs = require('fs');
let code = fs.readFileSync('src/components/WelcomeScreen.tsx', 'utf8');

const variants = `  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
    exit: { opacity: 0, y: -6, transition: { duration: 0.2, ease: 'easeOut' } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col items-center justify-center w-full max-w-xl px-4 py-8 mx-auto my-auto text-center"
    >`;

code = code.replace(/  return \(\n    <motion\.div \n      initial={{ opacity: 0, y: 6 }}\n      animate={{ opacity: 1, y: 0 }}\n      exit={{ opacity: 0, y: -6 }}\n      transition={{ duration: 0\.2, ease: 'easeOut' }}\n      className="flex flex-col items-center justify-center w-full max-w-xl px-4 py-8 mx-auto my-auto text-center"\n    >/g, variants);

code = code.replace(/<div className="flex flex-col items-center gap-3 mb-6">/g, '<motion.div variants={itemVariants} className="flex flex-col items-center gap-3 mb-6">');
code = code.replace(/<\/p>\n      <\/div>\n\n      {\/\* Model Selector Card/g, '</p>\n      </motion.div>\n\n      {/* Model Selector Card');

code = code.replace(/<div className={`w-full p-4 sm:p-5/g, '<motion.div variants={itemVariants} className={`w-full p-4 sm:p-5');
code = code.replace(/<\/p>\n      <\/div>\n\n      {\/\* Discrete Prompt Suggestions/g, '</p>\n      </motion.div>\n\n      {/* Discrete Prompt Suggestions');

code = code.replace(/<div className="w-full space-y-2\.5">/g, '<motion.div variants={itemVariants} className="w-full space-y-2.5">');
code = code.replace(/<\/button>\n          \)}\n        <\/div>\n      <\/div>/g, '</button>\n          )}\n        </div>\n      </motion.div>');

code = code.replace(/<div className="mt-6">/g, '<motion.div variants={itemVariants} className="mt-6">');
code = code.replace(/<\/button>\n        <\/div>\n      \)}/g, '</button>\n        </motion.div>\n      )}');

fs.writeFileSync('src/components/WelcomeScreen.tsx', code);
