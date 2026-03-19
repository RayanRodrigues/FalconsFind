export type CreateClaimRequest = {
  referenceCode: string;
  itemName: string;
  claimReason: string;
  proofDetails: string;
  claimantName: string;
  claimantEmail: string;
  phone?: string;
};
