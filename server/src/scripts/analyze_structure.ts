import { sequelize } from "../models";

async function analyzeSectionDepartmentRelationship() {
    try {
       
        await sequelize.authenticate();

        const [results]: any[] = await sequelize.query(`
            SELECT 
                S.id as sec_id, 
                S.name as sec_name, 
                D.id as dep_id, 
                D.name as dep_name,
                COUNT(O.id_dec) as total_count
            FROM MDSN.dbo.operator_table O
            LEFT JOIN MDSN.dbo.sections S ON O.section = S.id
            LEFT JOIN MDSN.dbo.departments D ON O.department = D.id
            WHERE O.is_active = 1
            GROUP BY S.id, S.name, D.id, D.name
            ORDER BY S.id, D.id
        `);

      
        
        let currentSecId = null;
        results.forEach((row: any) => {
            if (row.sec_id !== currentSecId) {
              
                currentSecId = row.sec_id;
            }
    
        });

        process.exit(0);
    } catch (error) {
        console.error("❌ Hata:", error);
        process.exit(1);
    }
}

analyzeSectionDepartmentRelationship();
