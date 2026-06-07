import { apiClient } from "./apiClient";

export type PublicService = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceFrom?: string | number | null;
  priceTo?: string | number | null;
  guestFrom?: number | null;
  guestTo?: number | null;
  locationText?: string | null;
  coverImageUrl?: string | null;
  isFeatured: boolean;
  isActive: boolean;
  category: {
    name: string;
    slug: string;
  };
};

export type PublicServiceCategory = {
  id: string;
  name: string;
  slug: string;
};

export type PublicPortfolioItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  content?: string | null;
  guestCount?: number | null;
  coverImageUrl: string;
  status: string;
  viewCount: number;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicBlogPost = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt?: string | null;
  content?: string | null;
  coverImageUrl?: string | null;
  status: string;
  viewCount: number;
  publishedAt?: string | null;
  createdAt: string;
};

export type PublicTestimonial = {
  id: string;
  customerName: string;
  roleText: string;
  content: string;
  rating: number;
  isFeatured: boolean;
  isActive: boolean;
};

export type PublicStat = {
  number: string;
  label: string;
};

export const getPublicServices = async () =>
  apiClient.get<PublicService[]>("/public/services");

export const getAllServices = async (params?: { category?: string; search?: string; featured?: boolean }) =>
  apiClient.get<PublicService[]>("/public/services", params);

export const getServiceBySlug = async (slug: string) =>
  apiClient.get<PublicService>(`/public/services/${slug}`);

export const getStats = async (): Promise<PublicStat[]> => {
  // Backend does not expose /public/stats yet. Return empty data instead of mock numbers.
  return [];
};

export const getTestimonials = async () =>
  apiClient.get<PublicTestimonial[]>("/public/testimonials");

export const getPortfolioItems = async (params?: { category?: string; visibleOnly?: boolean }) =>
  apiClient.get<PublicPortfolioItem[]>("/public/portfolio", params);

export const getPortfolioBySlug = async (slug: string) =>
  apiClient.get<PublicPortfolioItem>(`/public/portfolio/${slug}`);

export const getServiceCategories = async () =>
  apiClient.get<PublicServiceCategory[]>("/public/service-categories");

export const getBlogPosts = async (params?: { category?: string; search?: string; status?: string; pageSize?: number }) =>
  apiClient.get<PublicBlogPost[]>("/public/blog-posts", params);

export const getBlogPostById = async (id: string) =>
  apiClient.get<PublicBlogPost>(`/public/blog-posts/${id}`);
