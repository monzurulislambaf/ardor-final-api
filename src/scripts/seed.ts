/**
 * Seeds a development database with experts, users, appointments and enquiries.
 *
 *   npm run seed            # upsert experts/users; add sample bookings only if none exist
 *   npm run seed -- --reset # wipe experts, appointments and enquiries first
 *
 * Login credentials can be overridden with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 * and SEED_CLIENT_EMAIL / SEED_CLIENT_PASSWORD.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { createExpertSchema } from '../modules/experts/experts.schema';
import { ExpertModel } from '../modules/experts/experts.model';
import { UserModel } from '../modules/users/users.model';
import { AppointmentModel } from '../modules/appointments/appointments.model';
import { appointmentsService } from '../modules/appointments/appointments.service';
import { EnquiryModel } from '../modules/enquiries/enquiries.model';

const ADMIN = {
  name: 'Ardor Administrator',
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@ardor.test',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345',
};
const CLIENT = {
  name: 'Eleanor Vance',
  email: process.env.SEED_CLIENT_EMAIL ?? 'client@ardor.test',
  password: process.env.SEED_CLIENT_PASSWORD ?? 'Client12345',
};

const demoForensicExperts = [
  {
    name: 'Dr. Amina Rahman (Demo)',
    slug: 'demo-amina-rahman',
    category: 'country-forensic',
    title: 'Country Expert — South Asia',
    initials: 'AR',
    shortBio: 'Demo profile: country conditions expert for Bangladesh and India, preparing CPR Part 35 compliant reports for immigration and asylum tribunals.',
    bio: ['Demo profile created by the seed script. Replace with a real expert from the admin dashboard.'],
    specialisms: ['Country Conditions Reports', 'State Protection Analysis', 'Internal Relocation'],
    qualifications: ['PhD Political Science (demo)'],
    location: 'London, United Kingdom',
    languages: ['English', 'Bengali', 'Hindi'],
    availability: 'Standard 3–4 weeks; expedited 10–14 days on instruction.',
    fee: 'Quoted on instruction',
    expertiseCountries: ['Bangladesh', 'India', 'Pakistan'],
    forensicSpecialties: [],
    suitableFor: [
      'First-tier & Upper Tribunal Immigration and Asylum Appeals',
      'Human Rights Applications (Articles 2, 3, 8 ECHR)',
      'Internal Relocation Feasibility Assessments',
      'State Protection and Non-State Actor Persecution Analysis',
    ],
    standards: 'CPR Part 35 / Criminal Procedure Rules compliant; rigorous declaration of truth and independence.',
    turnaround: 'Standard 3–4 weeks; expedited 10–14 days available on instruction.',
    featured: true,
    order: 0,
  },
  {
    name: 'Dr. James Whitfield (Demo)',
    slug: 'demo-james-whitfield',
    category: 'country-forensic',
    title: 'Forensic Psychologist',
    initials: 'JW',
    shortBio: 'Demo profile: forensic psychologist providing fitness to plead, suggestibility and risk assessments for criminal and family courts.',
    bio: ['Demo profile created by the seed script. Replace with a real expert from the admin dashboard.'],
    specialisms: ['Fitness to Plead', 'Suggestibility Assessment', 'Risk of Harm Formulation'],
    qualifications: ['DForenPsy (demo)'],
    location: 'Manchester, United Kingdom',
    languages: ['English'],
    availability: 'Standard 4–6 weeks including clinical interview.',
    fee: 'Quoted on instruction',
    expertiseCountries: [],
    forensicSpecialties: ['Criminal', 'Family', 'Civil / Personal Injury'],
    suitableFor: [
      'Fitness to Plead and Stand Trial Evaluations',
      'Intermediary Requirement & Suggestibility Assessments',
      'Risk of Harm / Offending Psychological Formulations',
      'Sentencing Mitigation & Psychological Context Reports',
    ],
    standards: 'Strict adherence to British Psychological Society (BPS) and court guidelines.',
    turnaround: 'Standard 4–6 weeks including clinical interview and psychometric testing.',
    featured: false,
    order: 1,
  },
];

const upsertUser = async (data: { name: string; email: string; password: string }, role: 'admin' | 'client') => {
  const existing = await UserModel.findOne({ email: data.email });
  if (existing) {
    existing.role = role;
    existing.status = 'active';
    existing.password = data.password;
    await existing.save();
    return existing;
  }
  return UserModel.create({ ...data, role });
};

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
};

const main = async (): Promise<void> => {
  const reset = process.argv.includes('--reset');
  await connectDatabase();

  try {
    if (reset) {
      await Promise.all([ExpertModel.deleteMany({}), AppointmentModel.deleteMany({}), EnquiryModel.deleteMany({})]);
      console.log('Cleared experts, appointments and enquiries.');
    }

    const rawExperts = JSON.parse(readFileSync(path.join(__dirname, 'data', 'experts.json'), 'utf8')) as unknown[];
    const experts = [...rawExperts, ...demoForensicExperts].map((e) => createExpertSchema.parse(e));
    for (const expert of experts) {
      await ExpertModel.updateOne({ slug: expert.slug }, { $set: expert }, { upsert: true, runValidators: true });
    }
    console.log(`Upserted ${experts.length} experts.`);

    await upsertUser(ADMIN, 'admin');
    const client = await upsertUser(CLIENT, 'client');
    console.log(`Users ready: admin ${ADMIN.email}, client ${CLIENT.email}.`);

    if ((await AppointmentModel.estimatedDocumentCount()) === 0) {
      const bySlug = async (slug: string) => (await ExpertModel.findOne({ slug }))?.id as string | undefined;
      const bookings = [
        { slug: 'sagar-barua', category: 'psychologist', type: 'initial-consultation', days: 3, status: 'confirmed', mine: true },
        { slug: 'sajin-hossain', category: 'psychologist', type: 'follow-up', days: 10, status: 'pending', mine: true },
        { slug: 'demo-amina-rahman', category: 'country-forensic', type: 'expert-report', days: -14, status: 'completed', mine: true },
        { slug: 'mehedi-hasan-aupu', category: 'psychologist', type: 'initial-consultation', days: 5, status: 'pending', mine: false },
        { slug: 'demo-james-whitfield', category: 'country-forensic', type: 'assessment', days: 7, status: 'in-progress', mine: false },
        { slug: 'azwad-zaman', category: 'training', type: 'training-session', days: 21, status: 'cancelled', mine: false },
      ] as const;

      for (const [i, b] of bookings.entries()) {
        const { appointment } = await appointmentsService.create(
          {
            expertId: await bySlug(b.slug),
            clientName: b.mine ? CLIENT.name : `Guest Client ${i + 1}`,
            clientEmail: b.mine ? CLIENT.email : `guest${i + 1}@example.com`,
            clientPhone: '+44 7700 900' + String(100 + i),
            expertCategory: b.category,
            type: b.type,
            preferredDate: daysFromNow(b.days),
            preferredTime: 'Afternoon (14:00 - 18:00 BST / UK Time)',
            notes: 'Seeded sample appointment.',
          },
          b.mine ? (client.id as string) : undefined,
        );
        appointment.status = b.status;
        await appointment.save();
      }
      console.log(`Created ${bookings.length} appointments.`);
    } else {
      console.log('Appointments already exist; skipped sample bookings.');
    }

    if ((await EnquiryModel.estimatedDocumentCount()) === 0) {
      await EnquiryModel.insertMany([
        { name: 'Sarah Thompson', email: 'sarah@lawfirm.example.com', subject: 'Expert Report Instruction (Immigration & Asylum Appeal)', message: 'We would like to instruct a country expert for an upcoming First-tier Tribunal hearing. Please advise availability.', topic: 'expert-report', status: 'new' },
        { name: 'Daniel Okafor', email: 'daniel@company.example.com', subject: 'Professional Training Enquiry', message: 'Interested in a workplace resilience workshop for 40 staff next quarter. Could you share a proposal?', topic: 'training', status: 'in-progress' },
        { name: 'Priya Shah', email: 'priya@example.com', subject: 'Psychological Services Appointment', message: 'Looking for online CBT sessions in the evenings. Do you have availability next month?', topic: 'psychological-services', status: 'resolved', repliedAt: new Date() },
        { name: 'Tom Hughes', email: 'tom@example.com', subject: 'General Enquiry', message: 'Do you offer sessions in Bengali for family members living in the UK?', topic: 'general', status: 'new' },
      ]);
      console.log('Created 4 enquiries.');
    } else {
      console.log('Enquiries already exist; skipped sample enquiries.');
    }
  } finally {
    await disconnectDatabase();
  }
};

main().catch((error) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
