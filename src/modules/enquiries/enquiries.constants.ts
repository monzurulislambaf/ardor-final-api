export const ENQUIRY_STATUSES = ['new', 'in-progress', 'resolved', 'closed'] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_TOPICS = ['general', 'expert-report', 'training', 'psychological-services', 'legal-proceedings', 'other'] as const;
export type EnquiryTopic = (typeof ENQUIRY_TOPICS)[number];
